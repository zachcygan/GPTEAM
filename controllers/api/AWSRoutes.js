const uuid = require('uuid').v4;
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const multer = require('multer');
require('dotenv').config();
const router = require('express').Router();
const { Document } = require('../../models')



const s3Uploadv3 = async (files) => {
    const s3client = new S3Client();

    const params = files.map((file) => {
        return {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: `uploads/${uuid()}-${file.originalname}`,
            Body: file.buffer,
        };
    });

    const uploadData = await Promise.all(
        params.map((param) => s3client.send(new PutObjectCommand(param)))
    );

    return uploadData.map((response, index) => {
        return{
            ...response,
            Key: params[index].Key
        }
    })
};

//these are multer middleware for aws storage
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (file.mimetype.split("/")[0] === 'application') {
        cb(null, true);
    } else {
        cb(new Error("File is not the correct format", false));
    }
}
const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10000000000, files: 2 },
});

router.post("/upload", upload.array("file"), async (req, res) => {
    try {
        if(req.files.length > 0) {
        const results = await s3Uploadv3(req.files);

        const s3BucketURL = `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/`;

        const document = await Document.create({
            bucket_link: s3BucketURL + results[0].Key, // Assuming you're uploading a single file
            career_field: req.body.career_field,
            text: req.body.text,
            post_title: req.body.title,
            user_id: req.session.user_id
        })
    
        return res.json({ status: "success", document });
    }else {
        const document = await Document.create({
            bucket_link: null,
            career_field: req.body.career_field,
            text: req.body.text,
            post_title: req.body.title,
            user_id: req.session.user_id
        })
        return res.json({ status: "success", document });

    }
    } catch (err) {
        console.log(err);
    }
});

router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                message: "file is too large",
            });
        }

        if (error.code === "LIMIT_FILE_COUNT") {
            return res.status(400).json({
                message: "File limit reached",
            });
        }

        if (error.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
                message: "File must be an image",
            });
        }
    }
});

module.exports = router;