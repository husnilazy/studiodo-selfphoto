// Mengizinkan browser mengunggah langsung (presigned PUT) ke bucket "website" di Neon Object Storage.
// Jalankan: node --env-file=.env.local scripts/neon-bucket-cors.mjs https://kasir.studiodo.id https://selfphoto.studiodo.id
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";

const origins = process.argv.slice(2);
if (!origins.length) { console.error("Sebutkan origin yang diizinkan, mis. https://kasir.studiodo.id"); process.exit(1); }
const s3 = new S3Client({ forcePathStyle: true });
await s3.send(new PutBucketCorsCommand({
  Bucket: "website",
  CORSConfiguration: { CORSRules: [
    { AllowedOrigins: [...origins, "http://localhost:3000"], AllowedMethods: ["PUT", "GET", "HEAD"], AllowedHeaders: ["*"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 3600 },
  ] },
}));
console.log(JSON.stringify((await s3.send(new GetBucketCorsCommand({ Bucket: "website" }))).CORSRules, null, 2));
