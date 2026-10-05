import mongoose, { Schema } from 'mongoose';
const codeCounterSchema = new Schema({
    _id: { type: String, required: true },
    sequence: { type: Number, required: true, default: 0 }
}, { versionKey: false });
export const CodeCounter = mongoose.model('CodeCounter', codeCounterSchema);
