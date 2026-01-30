const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary.config');

exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Chat.find({ members: userId })
      .populate('members', 'name username avatar')
      .populate({
        path: 'lastMessageId',
        populate: {
          path: 'senderId',
          select: 'name username avatar',
        },
      })
      .sort({ updatedAt: -1 });

    const conversationsWithStatus = await Promise.all(
      conversations.map(async (conv) => {
        const conversationObj = conv.toObject();

        const hasUserSeen = conv.seenBy.map((id) => id.toString()).includes(userId.toString());

        conversationObj.hasNewMessages = !hasUserSeen;

        if (
          conversationObj.lastMessageId &&
          conversationObj.lastMessageId.deletedFor
            ?.map((id) => id.toString())
            .includes(userId.toString())
        ) {
          const lastVisibleMessage = await Message.findOne({
            chatId: conversationObj._id,
            deletedFor: { $ne: userId },
          }).sort({ createdAt: -1 });

          conversationObj.lastMessageId = lastVisibleMessage || null;
        }

        return conversationObj;
      })
    );

    res.json({ success: true, conversations: conversationsWithStatus });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Failed to load conversations' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findOne({ _id: chatId, members: userId });
    if (!chat) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!chat.seenBy.some((id) => id.equals(userId))) {
      chat.seenBy.push(userId);
      await chat.save();
    }

    const messages = await Message.find({ chatId })
      .populate('senderId', 'name username avatar')
      .sort({ createdAt: 1 });

    messages.forEach((msg) => {
      if (msg.deletedFor.includes(userId)) {
        msg.text = '';
        msg.media = [];
      }
    });

    res.json({ success: true, messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to load messages' });
  }
};

const uploadToCloudinary = async (file, folder) => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder,
      resource_type: 'auto',
    });
    return result;
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { chatId, text } = req.body;
    const userId = req.user._id;
    const files = req.files || [];

    const chat = await Chat.findOne({ _id: chatId, members: userId }).populate('members', '_id');
    if (!chat) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const media = [];
    for (const file of files) {
      try {
        const result = await uploadToCloudinary(file, 'messages');
        media.push({
          url: result.secure_url,
          type: getMediaType(file.mimetype),
          publicId: result.public_id,
        });
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
      }
    }

    const message = new Message({
      chatId,
      senderId: userId,
      text: text || '',
      media,
    });

    await message.save();

    chat.seenBy = [userId];
    chat.lastMessageId = message._id;
    chat.hasNewMessages = true;
    await chat.save();

    await chat.populate('members', 'name username avatar');
    await message.populate('senderId', 'name username avatar');

    if (global._io) {
      global._io.to(chatId).emit('newMessage', {
        message,
        conversationStatus: {
          seenBy: chat.seenBy,
          hasNewMessages: true,
        },
      });

      chat.members.forEach((member) => {
        global._io.to(`user_${member._id}`).emit('refreshConversationList');
      });

      console.log(
        `[SOCKET] Emitted refreshConversationList to members:`,
        chat.members.map((m) => m._id).filter((id) => id.toString() !== userId.toString())
      );
    }

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

exports.markAsSeen = async (req, res) => {
  try {
    const { chatId } = req.body;
    const userId = req.user._id;

    const chat = await Chat.findOne({ _id: chatId, members: userId });
    if (!chat) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!chat.seenBy.some((id) => id.equals(userId))) {
      chat.seenBy.push(userId);
      await chat.save();
    }

    if (global._io) {
      global._io.to(chatId.toString()).emit('conversationSeen', {
        chatId: chat._id,
        seenBy: chat.seenBy,
        userId: userId,
      });
    }

    res.json({ success: true, seenBy: chat.seenBy });
  } catch (error) {
    console.error('Mark as seen error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark conversation as seen' });
  }
};

exports.getOrCreateConversation = async (req, res) => {
  try {
    const { userId: otherUserId } = req.params;
    const currentUserId = req.user._id;

    if (otherUserId === currentUserId.toString()) {
      return res
        .status(400)
        .json({ success: false, message: 'Cannot create conversation with yourself' });
    }

    let conversation = await Chat.findOne({
      isGroup: false,
      members: { $all: [currentUserId, otherUserId], $size: 2 },
    }).populate('members', 'name username avatar');

    if (!conversation) {
      const otherUser = await User.findById(otherUserId);
      if (!otherUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      conversation = new Chat({
        members: [currentUserId, otherUserId],
        isGroup: false,
        seenBy: [currentUserId],
      });

      await conversation.save();
      await conversation.populate('members', 'name username avatar');
    }

    res.json({ success: true, conversation });
  } catch (error) {
    console.error('Get or create conversation error:', error);
    res.status(500).json({ success: false, message: 'Failed to get conversation' });
  }
};

exports.createGroupConversation = async (req, res) => {
  try {
    const { groupName, memberIds } = req.body;
    const currentUserId = req.user._id;

    if (!groupName || !memberIds || memberIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Group name and members are required' });
    }

    const membersArray = Array.isArray(memberIds) ? memberIds : JSON.parse(memberIds);

    const allMembers = [...new Set([currentUserId, ...membersArray])];

    const users = await User.find({ _id: { $in: allMembers } });
    if (users.length !== allMembers.length) {
      return res.status(400).json({ success: false, message: 'One or more users not found' });
    }

    let groupIcon = null;
    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file, 'groups');
        groupIcon = result.secure_url;
      } catch (uploadError) {
        console.error('Group icon upload error:', uploadError);
        return res.status(400).json({ success: false, message: 'Failed to upload group icon' });
      }
    }

    const conversation = new Chat({
      members: allMembers,
      isGroup: true,
      groupName,
      groupIcon,
      seenBy: [currentUserId],
    });

    await conversation.save();
    await conversation.populate('members', 'name username avatar');

    res.status(201).json({ success: true, conversation });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ success: false, message: 'Failed to create group' });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteType } = req.query;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const chat = await Chat.findOne({ _id: message.chatId, members: userId }).populate(
      'members',
      '_id'
    );

    if (deleteType === 'me') {
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { deletedFor: userId },
      });

      chat.members.forEach((member) => {
        global._io.to(`user_${member._id}`).emit('refreshConversationList');
      });

      return res.json({
        success: true,
        message: 'Message deleted for you',
      });
    }

    if (deleteType === 'everyone') {
      if (!message.senderId.equals(userId)) {
        return res.status(403).json({
          success: false,
          message: 'Only sender can delete for everyone',
        });
      }

      if (message.media?.length > 0) {
        for (const media of message.media) {
          if (media.publicId) {
            await cloudinary.uploader.destroy(media.publicId);
          }
        }
      }

      await Message.findByIdAndUpdate(messageId, {
        text: '',
        media: [],
        isDeletedForEveryone: true,
      });

      if (global._io) {
        global._io.to(message.chatId.toString()).emit('messageDeleted', { messageId });
      }

      chat.members.forEach((member) => {
        global._io.to(`user_${member._id}`).emit('refreshConversationList');
      });

      return res.json({
        success: true,
        message: 'Message deleted for everyone',
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid delete type',
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
    });
  }
};

const getMediaType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'file';
};
