const express = require('express');
const router = express.Router();
const supabase = require('../services/db');

// Mock User ID for demo (Sarah Jenkins)
// In a real app, this comes from req.user set by auth middleware
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

// Get Profile
router.get('/', async (req, res) => {
    try {
        // Try fetch
        let { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', DEMO_USER_ID)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is not found
            throw error;
        }

        if (!data) {
            // Return default if not found (or create)
            return res.json({
                name: "Sarah Jenkins",
                role: "高级法律顾问",
                email: "sarah.jenkins@elitelegal.ai",
                bio: "拥有10年以上的企业法务经验，专注于知识产权和合同法。",
                avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuD27DqlS6gQSAZbVQMLjq_EGNkl8kaAxbfUGr3SQ28wkzZn7KnXiw7J8B_QQVPcOzIUVT6-1rXZ6TtMDXneDFA6fT8zI5-NpOaHph3DzvvL3gSojFYYowich52DECD6CJeSa0DIxn-YnOsohTHY9QDA9su4IkqHcU9UfOTewNtgPRp0lGbHnxbTq1dvNElUa1wrYA1FS3oetoEZcql_sRXWsZIQL1bKyI9sYzVjgJoWu-MFZfWWeVkb7hfwzlrmLdbRg91Y_mwfplg"
            });
        }

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update Profile
router.post('/', async (req, res) => {
    const { name, role, email, bio, avatar } = req.body;

    try {
        // Upsert
        const { data, error } = await supabase
            .from('profiles')
            .upsert({
                id: DEMO_USER_ID,
                username: email,
                full_name: name,
                avatar_url: avatar,
                role: role,
                bio: bio
            })
            .select();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

module.exports = router;
