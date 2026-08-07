const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../server');

async function testApi() {
  const server = app.listen(0, async () => {
    const port = server.address().port;
    console.log(`Test server running on port ${port}`);

    const filePath = path.join(__dirname, '../RINCIAN KERTAS KERJA SATKER.xlsx');
    const fileBuffer = fs.readFileSync(filePath);

    const boundary = '--------------------------' + Date.now().toString(16);
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="RINCIAN.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;

    const body = Buffer.concat([
      Buffer.from(header, 'utf8'),
      fileBuffer,
      Buffer.from(footer, 'utf8')
    ]);

    const req = http.request(`http://localhost:${port}/api/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response JSON:', JSON.parse(data));
        server.close();
      });
    });

    req.write(body);
    req.end();
  });
}

testApi().catch(console.error);
