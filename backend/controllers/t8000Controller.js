const {
  T8000IngestError,
  ingestT8000Payload
} = require("../adapters/t8000Adapter");

const TOKEN_HEADER_NAME = "x-t8000-token";

exports.ingestMeasurements = async (req, res, next) => {
  try {
    const configuredToken = process.env.T8000_INGEST_TOKEN;

    if (configuredToken && req.get(TOKEN_HEADER_NAME) !== configuredToken) {
      return res.status(401).json({
        message: "Unauthorized T8000 request"
      });
    }

    const result = await ingestT8000Payload(req.body);

    return res.status(200).json({
      message: "T8000 payload processed successfully",
      ...result
    });
  } catch (error) {
    if (error instanceof T8000IngestError) {
      return res.status(error.statusCode).json({
        message: error.message,
        details: error.details
      });
    }

    return next(error);
  }
};
