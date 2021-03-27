const express = require('express');
const fs = require('fs');
const util = require('util');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const filePath = './countfile.txt';

const app = express()
const port = 3000

app.get('/request-count', async (req, res) => {

  let newCount;
  try {
    const count = await readFile(filePath);
    newCount = `${+count + 1}`;
  } catch (err) {
    newCount = "1";
  }

  await writeFile(filePath, Buffer.from(newCount));
  res.send(newCount);
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})