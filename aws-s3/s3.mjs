import path from 'path';
import dotenv from 'dotenv';
import { S3Client, ListBucketsCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

if (!process.env.PROCESS) {
  dotenv.config({ path: path.join(process.cwd(), './.env') });
}

const s3Config = {
  region: "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
const client = new S3Client(s3Config);
const BUCKET_NAME = process.env.AWS_S3_BUCKET;

if (!BUCKET_NAME) {
  throw new Error('Missing AWS_S3_BUCKET environment variable');
}

/**
 * Helper Functions
 */
const createPresignedUrlWithoutClient = async ({region, bucket, key}) => {
  const url = parseUrl(`https://${bucket}.s3.${region}.amazonaws.com/${key}`);
  const presigner = new S3RequestPresigner({
    credentials: fromIni(),
    region,
    sha256: Hash.bind(null, "sha256"),
  });

  const signedUrlObject = await presigner.presign(new HttpRequest(url));
  return formatUrl(signedUrlObject);
};

const createPresignedUrlWithClient = ({region, bucket, key}) => {
  const client = new S3Client({region});
  const command = new GetObjectCommand({Bucket: bucket, Key: key});
  return getSignedUrl(client, command, {expiresIn: 3600});
};

const demoUploadImage = async () => {
  const REGION = "us-east-1";
  const BUCKET = BUCKET_NAME;
  const KEY = "nodejs-logo.png";

  try {
    const noClientUrl = await createPresignedUrlWithoutClient({
      region: REGION,
      bucket: BUCKET,
      key: KEY,
    });

    const clientUrl = await createPresignedUrlWithClient({
      region: REGION,
      bucket: BUCKET,
      key: KEY,
    });

    console.log("Presigned URL without client");
    console.log(noClientUrl);
    console.log("\n");

    console.log("Presigned URL with client");
    console.log(clientUrl);
  } catch (err) {
    console.error(err);
  }
};

const getFileURL = (fileObj) => {
  return `https://${BUCKET_NAME}.s3.amazonaws.com/${fileObj.name}`;
}

/**
 * CLI Functions
 */
const listBuckets = async () => {
  const command = new ListBucketsCommand({});
  try {
    const { Owner, Buckets } = await client.send(command);
    console.log(`${Owner.DisplayName} owns ${Buckets.length} bucket${Buckets.length === 1 ? '' : 's'}:`);
    console.log(`${Buckets.map((b) => ` • ${b.Name}`).join('\n')}`);
  } catch (err) {
    console.error(err);
  }
};

const uploadFile = async (fileObj) => {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileObj.name,
    Body: fileObj.content,
    ContentType: fileObj.contentType,
    ACL: "public-read",
  });

  try {
    const response = await client.send(command);
    console.log('Uploaded file to S3', response);
    console.log('File URL', getFileURL(fileObj));
  } catch (err) {
    console.error(err);
  }
};

const listFiles = async () => {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    // The default and maximum number of keys returned is 1000. This limits it to
    // one for demonstration purposes.
    MaxKeys: 1,
  });

  try {
    let isTruncated = true;

    console.log("Your bucket contains the following objects:\n")
    let contents = "";

    while (isTruncated) {
      const { Contents, IsTruncated, NextContinuationToken } = await client.send(command);
      const contentsList = Contents.map((c) => ` • ${c.Key}`).join("\n");
      contents += contentsList + "\n";
      isTruncated = IsTruncated;
      command.input.ContinuationToken = NextContinuationToken;
    }
    console.log(contents);

  } catch (err) {
    console.error(err);
  }
}

/**
 * Main CLI App
 */
const argv = process.argv.slice(2);
const CMD_LIST = argv.indexOf('ls') > -1;
const CMD_CREATE = argv.indexOf('create') > -1;
const CMD_UPLOAD = argv.indexOf('upload') > -1;
const CMD_LIST_FILES = argv.indexOf('list-files') > -1;


if (CMD_LIST) 
{
  listBuckets();
} 
else if (CMD_UPLOAD) 
{
  const fileObj = {
    name: "example-2765a060f930cb2e78a7a967e085bd44bbaade61e.css",
    content: "body { background-color: green; }",
    contentType: "text/css",
  }
  uploadFile(fileObj);
}
else if (CMD_LIST_FILES) 
{
  listFiles();
}
else 
{
  console.log('Invalid option!');
}
