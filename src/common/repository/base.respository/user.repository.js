import { UserModel } from "../../../DB/model/user.model.js";
import * as baseRepo from "./base.repository.js";

export const createUser = async ({ data, options } = {}) => {
    return await baseRepo.createOne({ model: UserModel, data, options });
};

export const findUserById = async ({ id, select = "-password", options = {} } = {}) => {
    return await baseRepo.findById({
        model: UserModel,
        id,
        options: {
            select,
            lean: true,
            ...options
        }
    });
};

export const findUserByEmail = async ({ email, select = "-password", options = {} } = {}) => {
    return await baseRepo.findOne({
        model: UserModel,
        filter: { email },
        select,
        options: {
            lean: true,
            ...options
        }
    });
};

export const findOneUser = async ({ filter = {}, select = "-password", options = {} } = {}) => {
    return await baseRepo.findOne({
        model: UserModel,
        filter,
        select,
        options: {
            lean: true,
            ...options
        }
    });
};

export const findUsers = async ({ filter = {}, select = "-password", options = {} } = {}) => {
    return await baseRepo.find({
        model: UserModel,
        filter,
        options: {
            select,
            lean: true,
            ...options
        }
    });
};

export const paginateUsers = async ({ filter = {}, select = "-password", page, limit, options = {} } = {}) => {
    return await baseRepo.paginate({
        model: UserModel,
        filter,
        select,
        page,
        limit,
        options: {
            sort: { createdAt: -1 },
            lean: true,
            ...options
        }
    });
};

export const updateUserById = async ({ id, update, options = { new: true } } = {}) => {
    return await baseRepo.findByIdAndUpdate({
        model: UserModel,
        id,
        update,
        options
    });
};

export const updateOneUser = async ({ filter, update, options } = {}) => {
    return await baseRepo.updateOne({
        model: UserModel,
        filter,
        update,
        options
    });
};

export const deleteOneUser = async ({ filter = {} } = {}) => {
    return await baseRepo.deleteOne({ model: UserModel, filter });
};

