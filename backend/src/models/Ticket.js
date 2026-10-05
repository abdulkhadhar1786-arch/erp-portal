import mongoose, { Schema } from 'mongoose';
const attachmentSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    path: {
        type: String,
        required: true,
        trim: true
    },
    size: {
        type: Number,
        required: true,
        min: 0
    }
}, {
    _id: false
});
const ticketEventSchema = new Schema({
    type: {
        type: String,
        enum: ['created', 'assigned', 'unassigned', 'status_changed', 'updated'],
        required: true
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    actorName: { type: String, required: true, trim: true, maxlength: 120 },
    actorRole: { type: String, required: true, trim: true, maxlength: 40 },
    createdAt: { type: Date, default: Date.now, required: true }
}, { _id: false });
const ticketSchema = new Schema({
    ticketNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    customerId: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    customerName: {
        type: String,
        required: true,
        trim: true
    },
    branchId: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    branchName: {
        type: String,
        required: true,
        trim: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    reportedBy: {
        type: String,
        trim: true,
        maxlength: 120,
        default: ''
    },
    contactEmail: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 254,
        default: ''
    },
    contactPhone: {
        type: String,
        trim: true,
        maxlength: 40,
        default: ''
    },
    assetReference: {
        type: String,
        trim: true,
        maxlength: 160,
        default: ''
    },
    priority: {
        type: String,
        enum: [
            'Low',
            'Medium',
            'High',
            'Critical'
        ],
        default: 'Medium',
        index: true
    },
    status: {
        type: String,
        enum: [
            'New',
            'Assigned',
            'In Progress',
            'On Hold',
            'Resolved',
            'Closed'
        ],
        default: 'New',
        index: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    assignedTo: {
        type: String,
        default: '',
        trim: true
    },
    assignedRole: {
        type: String,
        default: '',
        trim: true
    },
    assignedEmployeeId: {
        type: String,
        default: '',
        trim: true,
        index: true
    },
    history: {
        type: [ticketEventSchema],
        default: []
    },
    attachments: {
        type: [
            attachmentSchema
        ],
        default: []
    }
}, {
    timestamps: true
});
ticketSchema.index({
    customerId: 1,
    branchId: 1
});
ticketSchema.index({
    status: 1,
    priority: 1
});
export const Ticket = mongoose.model('Ticket', ticketSchema);
