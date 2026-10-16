const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const passwordSchema = Joi.string().min(8).max(100).pattern(new RegExp('^(?=.*[A-Za-z])(?=.*\\d).+$')).messages({
    'string.min': 'Password minimal 8 karakter',
    'string.max': 'Password maksimal 100 karakter',
    'string.pattern.base': 'Password harus mengandung huruf dan angka'
});

const validateRequest = (schema) => {
    return (req, res, next) => {
        if (typeof req.body !== 'object' || req.body === null) req.body = {};
        const { error } = schema.validate(req.body, { abortEarly: false });
        if (error) {
            const errorMessage = error.details.map((detail) => detail.message).join(', ');
            return res.status(400).json({ message: errorMessage });
        }
        next();
    };
};

const rolesList = ['admin', 'staff', 'petugas kebersihan', 'guru ra', 'guru mi akhwat', 'guru mi ikhwan', 'guru tahfidz fase a', 'guru tahfidz fase b & c', 'guru asisten'];

// Allowlist of role values accepted when filtering by role.
const roleField = Joi.string().valid(...rolesList);

const validateQuery = (schema) => {
    return (req, res, next) => {
        // allowUnknown keeps pagination (page/limit) and other benign filters working
        const { error } = schema.validate(req.query, { abortEarly: false, allowUnknown: true });
        if (error) {
            const errorMessage = error.details.map((detail) => detail.message).join(', ');
            return res.status(400).json({ message: errorMessage });
        }
        next();
    };
};

const validateParams = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.params, { abortEarly: false });
        if (error) {
            const errorMessage = error.details.map((detail) => detail.message).join(', ');
            return res.status(400).json({ message: errorMessage });
        }
        next();
    };
};

const schemas = {
    // Auth
    login: Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required()
    }),

    // User Management (Admin)
    createUser: Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required(),
        password: passwordSchema.required(),
        name: Joi.string().min(2).max(50).required(),
        role: Joi.string().valid('admin', 'staff', 'petugas kebersihan', 'guru ra', 'guru mi akhwat', 'guru mi ikhwan', 'guru tahfidz fase a', 'guru tahfidz fase b & c', 'guru asisten').required()
    }),

    updateUser: Joi.object({
        username: Joi.string().alphanum().min(3).max(30),
        password: passwordSchema.allow('', null),
        name: Joi.string().min(2).max(50),
        role: Joi.string().valid('admin', 'staff', 'petugas kebersihan', 'guru ra', 'guru mi akhwat', 'guru mi ikhwan', 'guru tahfidz fase a', 'guru tahfidz fase b & c', 'guru asisten')
    }),

    changePassword: Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: passwordSchema.required().messages({
            'string.min': 'Password baru minimal 8 karakter'
        })
    }),

    // Admin-only password reset (optional temp password → generated otherwise)
    resetPassword: Joi.object({
        newPassword: passwordSchema.allow('', null)
    }),

    // Self-service profile update (name only)
    updateMyProfile: Joi.object({
        name: Joi.string().min(2).max(50).required()
    }),

    // Bulk leave requests approve/reject (Phase 3.5)
    bulkLeaveRequests: Joi.object({
        ids: Joi.array().items(objectId).min(1).max(200).required(),
        status: Joi.string().valid('approved', 'rejected').required()
    }),

    // Apply the same workday rules to one or more roles (Phase 3.5)
    bulkWorkDayUpdate: Joi.object({
        roles: Joi.array().items(roleField).min(1).required(),
        workDays: Joi.array().items(
            Joi.object({
                day: Joi.string().valid('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu').required(),
                isWorkDay: Joi.boolean().required(),
                startTime: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow('', null).default('00:00'),
                endTime: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow('', null).default('00:00'),
                ramadanStartTime: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow('', null),
                ramadanEndTime: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow('', null)
            })
        ).min(1).required()
    }),

    // Attendance/Records
    createRecord: Joi.object({
        staffId: Joi.string().hex().length(24).required(),
        type: Joi.string().valid('clock-in', 'clock-out').required(),
        photo: Joi.string().allow('', null),
        notes: Joi.string().max(500).allow('', null),
        location: Joi.object({
            latitude: Joi.number().min(-90).max(90),
            longitude: Joi.number().min(-180).max(180),
            distance: Joi.number().min(0),
            address: Joi.string().allow('', null)
        }).optional().allow(null)
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
    }),

    // Query validation
    query: {
        year: Joi.object({
            year: Joi.string().regex(/^\d{4}$/).required().messages({
                'string.pattern.base': 'Year harus berupa 4 digit angka'
            })
        }),
        date: Joi.object({
            date: Joi.string().isoDate().required()
        }),
        byDate: Joi.object({
            date: Joi.string().isoDate().required()
        }),
        role: Joi.object({
            role: Joi.string().valid('admin', 'staff', 'petugas kebersihan', 'guru ra', 'guru mi akhwat', 'guru mi ikhwan', 'guru tahfidz fase a', 'guru tahfidz fase b & c', 'guru asisten').required()
        }),
        correctionList: Joi.object({
            status: Joi.string().valid('pending', 'approved', 'rejected'),
            date: Joi.string().isoDate()
        }),
        matrix: Joi.object({
            year: Joi.string().regex(/^\d{4}$/),
            month: Joi.number().integer().min(1).max(12),
            role: roleField
        }),
        analytics: Joi.object({
            year: Joi.string().regex(/^\d{4}$/),
            month: Joi.number().integer().min(1).max(12),
            role: roleField,
            staffId: objectId
        }),
        ranking: Joi.object({
            month: Joi.number().integer().min(1).max(12),
            year: Joi.string().regex(/^\d{4}$/)
        }),
        exportRequests: Joi.object({
            status: Joi.string().valid('pending', 'approved', 'rejected'),
            role: roleField,
            month: Joi.number().integer().min(1).max(12),
            year: Joi.string().regex(/^\d{4}$/),
            date: Joi.string().isoDate(),
            format: Joi.string().valid('xlsx', 'csv')
        })
    },

    // Params validation
    params: {
        objectId: Joi.object({
            id: objectId.required()
        })
    }
};

module.exports = { validateRequest, validateQuery, validateParams, schemas };