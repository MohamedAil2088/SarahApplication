export const successResponse = ({ res, status = 200, data, message = true }) => {
    const response = { message, status }
    if (data !== undefined) {
        response.data = data
    }
    return res.status(status).json(response)
}