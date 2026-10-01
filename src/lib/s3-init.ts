import { ensureBucket } from "./s3";

await ensureBucket();
console.log("Bucket ready");
