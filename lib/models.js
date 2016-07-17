module.exports = {
    user: {
        name: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        nickname: { type: String }
    },
    session: {
        sid: { type: String, required: true, unique: true },
        user: { type: String, required: true, unique: true }
    },
    img: {
        name: { type: String },
        nickname: { type: String },
        date: { type: Date, index: true, required: true },
        word: { type: String },
        hint: { type: String },
        filename: { type: String, required: true, unique: true }
    }
};