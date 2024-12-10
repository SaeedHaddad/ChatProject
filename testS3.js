// testS3.js
const s3 = require("./awsConfig");

s3.listObjectsV2({ Bucket: process.env.AWS_BUCKET_NAME }, (err, data) => {
  if (err) {
    console.log("Error", err);
  } else {
    console.log("Success", data);
  }
});
