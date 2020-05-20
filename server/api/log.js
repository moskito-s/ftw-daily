module.exports = (req, res) => {
  console.log('log');
  console.log(req.cookies);
  res
    .set({
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': true,
    })
    .status(200)
    .json({
      req: {
        method: req.method,
        cookies: req.cookies || null,
        cookieHeader: req.get('Cookie'),
      },
    })
    .end();
};
