const Joi = require('joi');

const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, { abortEarly: false });
        if (error) {
            const errorMessage = error.details.map((detail) => detail.message).join(', ');
            return res.status(400).json({ message: errorMessage });
        }
        next();
    };
};

const schemas = {
    // Auth Validation
    register: Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required().messages({
            'string.min': 'Username minimal 3 karakter',
            'string.empty': 'Username tidak boleh kosong'
        }),
        password: Joi.string().min(6).required().messages({
            'string.min': 'Password minimal 6 karakter'
        }),
        name: Joi.string().min(2).max(50).required().messages({
            'string.empty': 'Nama tidak boleh kosong'
        }),
        role: Joi.string().valid('staff', 'petugas kebersihan', 'guru ra', 'guru mi akhwat', 'guru mi ikhwan', 'guru tahfidz fase a', 'guru tahfidz fase b & c').default('staff')
    }),

    login: Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required()
    }),

    // User Management (Admin)
    createUser: Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required(),
        password: Joi.string().min(6).required(),
        name: Joi.string().min(2).max(50).required(),
        role: Joi.string().valid('admin', 'staff', 'petugas kebersihan', 'guru ra', 'guru mi akhwat', 'guru mi ikhwan', 'guru tahfidz fase a', 'guru tahfidz fase b & c').required()
    }),

    updateUser: Joi.object({
        username: Joi.string().alphanum().min(3).max(30),
        password: Joi.string().min(6).allow('', null),
        name: Joi.string().min(2).max(50),
        role: Joi.string().valid('admin', 'staff', 'petugas kebersihan', 'guru ra', 'guru mi akhwat', 'guru mi ikhwan', 'guru tahfidz fase a', 'guru tahfidz fase b & c')
    }),

    changePassword: Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: Joi.string().min(6).required().messages({
            'string.min': 'Password baru minimal 6 karakter'
        })
    }),

    // Attendance/Records
    createRecord: Joi.object({
        staffId: Joi.string().hex().length(24).required(),
        type: Joi.string().valid('clock-in', 'clock-out').required(),
        photo: Joi.string().allow('', null) // Allow photo field
    }),

    submitAttendance: Joi.object({
        staffId: Joi.string().hex().length(24).required(),
        name: Joi.string().required(),
        status: Joi.string().valid('Hadir', 'Sakit', 'Izin', 'Alpha', 'Cuti').required(),
        date: Joi.string().isoDate().required(),
        time: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).required(),
        fromAdmin: Joi.boolean(),
        clockInTime: Joi.string().allow('', null),
        clockOutTime: Joi.string().allow('', null),
        notes: Joi.string().allow('', null)
    })
};

module.exports = { validateRequest, schemas };
