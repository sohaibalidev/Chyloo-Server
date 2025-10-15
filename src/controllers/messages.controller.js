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

    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          chatId: conv._id,
          senderId: { $ne: userId },
          seenBy: { $ne: userId },
        });

        const conversationObj = conv.toObject();
        conversationObj.unreadCount = unreadCount;
        return conversationObj;
      })
    );

    res.json({ success: true, conversations: conversationsWithUnread });
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

    const messages = await Message.find({ chatId })
      .populate('senderId', 'name username avatar')
      .populate('seenBy', 'name username avatar')
      .sort({ createdAt: 1 });

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

    const chat = await Chat.findOne({ _id: chatId, members: userId });
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

    chat.lastMessageId = message._id;
    await chat.save();

    await message.populate('senderId', 'name username avatar');
    await message.populate('seenBy', 'name username avatar');

    if (global._io) {
      global._io.to(chatId).emit('newMessage', message);
    }

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

exports.markAsSeen = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const chat = await Chat.findOne({ _id: message.chatId, members: userId });
    if (!chat) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!message.seenBy.includes(userId)) {
      message.seenBy.push(userId);
      await message.save();
    }

    await message.populate('seenBy', 'name username avatar');

    if (global._io) {
      global._io.to(message.chatId.toString()).emit('messageSeen', {
        messageId: message._id,
        seenBy: message.seenBy,
      });
    }

    res.json({ success: true, seenBy: message.seenBy });
  } catch (error) {
    console.error('Mark as seen error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark message as seen' });
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
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Can only delete your own messages' });
    }

    if (message.media && message.media.length > 0) {
      for (const media of message.media) {
        if (media.publicId) {
          await cloudinary.uploader.destroy(media.publicId);
        }
      }
    }

    await Message.findByIdAndDelete(messageId);

    if (global._io) {
      global._io.to(message.chatId.toString()).emit('messageDeleted', { messageId });
    }

    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete message' });
  }
};

const getMediaType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'file';
};
