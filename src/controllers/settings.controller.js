const { User } = require('../models');

exports.updateSettings = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No user found in request',
      });
    }

    const { theme, sidebar } = req.body;

    if (!theme && !sidebar) {
      return res.status(400).json({
        success: false,
        message: 'No settings provided to update',
      });
    }

    const validThemes = ['light', 'dark'];
    const validSidebar = ['expanded', 'collapsed'];

    const updateData = {};
    if (theme && validThemes.includes(theme)) updateData['settings.theme'] = theme;
    if (sidebar && validSidebar.includes(sidebar)) updateData['settings.sidebar'] = sidebar;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, select: 'settings' }
    );

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      settings: updatedUser.settings,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating settings',
    });
  }
};
