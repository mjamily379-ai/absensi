const mongoose = require('mongoose');
require('dotenv').config();

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/absensi-apps_db');
        require('./models/userModel');
        require('./models/staffModel');
        const LeaveRequest = require('./models/leaveRequestModel');
        const count = await LeaveRequest.countDocuments();
        console.log('Total Leave Requests:', count);
        
        const requests = await LeaveRequest.find().populate('userId', 'name').limit(5);
        console.log('Last 5 requests:', JSON.stringify(requests, null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
