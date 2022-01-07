const Error = require("../models/ValidationError");

const ErrorHandler =  function (err, req, res, next) {
    if(err) {
        let error;
         console.log(err)
       if (err.name === 'UnauthorizedError' || err.name ===  'MismatchedIssuer') {
           error = new Error(err.name, 'Invalid token.');
           res.status(401).send({...error, status: 401 });
       } else if(err.name === 'ECONNREFUSED') {
           error = new Error(err.name, 'Database connection error.');
           res.status(500).send({...error, status: 500 });
       } else if(err.name && err.name.startsWith('APP')) {
           error = new Error(err.name, err.description);
           res.status(404).send({...error, status: 404 });
       } else if(err.name === 'DUPLICATE_ENTRY') {
           res.status(409).send({...err, status: 409});
       }  else if(err.name === 'READ_ERROR') {
           res.status(500).send({...err, status: 500});
       } else if(err.name === 'SERVER_ERROR') {
           res.status(500).send({...err, status: 500});
       } else {
           error = new Error('BadRequestError', 'Bad Request.');
           res.status(400).send({...error, status: 400});
       }
    } else {
        next();
    }
};

module.exports = ErrorHandler;
