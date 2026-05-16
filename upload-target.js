import 'dotenv/config';
import fs from 'fs';
import { updateFile, getDefaultBranchSha } from './tools/github.js';

async function upload() {
  const content = fs.readFileSync('./demo/broken-demo.html', 'utf-8');
  const { branch } = await getDefaultBranchSha();
  await updateFile({
    path: 'index.html',
    content,
    message: 'Add target HTML file',
    branch
  });
  console.log('Uploaded index.html successfully!');
}
upload().catch(console.error);
