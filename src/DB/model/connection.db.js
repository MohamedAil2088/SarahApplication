
import mongoose from "mongoose";
import { DB_URI } from "../../config.js";
import { UserModel } from "./user.model.js";
import { connectRedis } from "../redis.connection.js";


export const bootstrapDB = async (app ,port)=>{
    try {
        await mongoose.connect(DB_URI, {serverSelectionTimeoutMS: 3000} )
        await UserModel.syncIndexes()
        console.log(`DB connected successfully 👌`);
        await connectRedis()
        const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`))
        return server;
    } catch (error) {
        console.error("DB Connection Error ❌:", error);
    }
}