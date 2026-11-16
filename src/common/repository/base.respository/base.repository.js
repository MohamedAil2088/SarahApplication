export const findOne = async ({
  model,
  filter = {},
  select = "",
  options = {},
} = {}) => {
  const doc = model.findOne(filter).select(select);
  if (options.session) doc.session(options.session);

  if (options.populate) {
    doc.populate(options.populate);
  }
  if (options.lean) {
    doc.lean();
  }

  return await doc.exec();
};

export const create = async ({
  model,
  data = [{}],
  options = { validateBeforeSave: true },
} = {}) => {
  return await model.create(data, options);
};

export const createOne = async ({
  model,
  data = {},
  options = { validateBeforeSave: true },
} = {}) => {
  const [doc] = await create({ model, data: [data], options });
  return doc;
};

export const findById = async ({ id, options = {}, model }) => {
  const doc = model.findById(id);
  if (options.session) doc.session(options.session);
  if (options.select) {
    doc.select(options.select)
  }
  if (options.populate) {
    doc.populate(options.populate);
  }
  if (options.lean) {
    doc.lean(options.lean);
  }
  return await doc.exec();
};

export const find = async ({ 
  filter={},
  options={},
  model
} = {}) => {
  const doc = model.find(filter);
  if (options.select) {
    doc.select(options.select)
  }
  if (options.populate) {
    doc.populate(options.populate);
  }
  if (options.skip) {
    doc.skip(options.skip);
  }
  if (options.limit) {
    doc.limit(options.limit);
  }
  if (options.sort) {
    doc.sort(options.sort);
  }
  if (options.lean) {
    doc.lean(options.lean);
  }
  
  return await doc.exec();
}

export const insertMany = async({  
    data,
    model
}) =>{
    return (await model.insertMany(data))
}

export const updateOne = async ({
    filter,
    update,
    options,
    model
} = {}) =>{
    return await model.updateOne(
        filter || {},
        {...update, $inc: {__v: 1}},
        options
    );
}

export const findOneAndUpdate = async({
    filter,
    update,
    options,
    model
} = {}) =>{
    return await model.findOneAndUpdate(
        filter || {},
        {...update, $inc: {__v: 1}},
        {
            new: true,
            runValidators: true,
            ...options,
        }
    )
}

export const findByIdAndUpdate = async({
    id,
    update,
    options = {new:true},
    model
}) =>{
    return await model.findByIdAndUpdate(
        id,
        {...update, $inc: {__v: 1}},
        options
    );
}

export const deleteOne = async({
    filter,
    model
}) =>{
    return await model.deleteOne(filter || {})
}

export const deleteMany = async({
    filter,
    model
}) =>{
    return await model.deleteMany(filter || {});
}

export const findOneAndDelete = async({ 
    filter,
    model
} = {}) =>{
    return await model.findOneAndDelete(
        filter || {},
    );
}

export const countDocument = async({ 
    filter,
    model
} = {}) =>{
    return await model.countDocuments(filter );
}

export const paginate = async ({
    model,
    filter = {},
    select = "",
    page = 1,
    limit = 5,
    options = {}
} = {}) => {
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.max(1, Number(limit) || 5);
    const skip = (pageNumber - 1) * limitNumber;

    const [totalCount, docs] = await Promise.all([
        countDocument({ filter, model }),
        find({
            model,
            filter,
            select,
            options: {
                lean: true,
                ...options,
                skip,
                limit: limitNumber
            }
        })
    ]);
    const pages = Math.ceil(totalCount / limitNumber);
    return {
        page: pageNumber,
        limit: limitNumber,
        totalCount,
        pages,
        docs
    };
};
