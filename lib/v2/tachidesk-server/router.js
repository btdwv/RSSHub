module.exports = function (router) {
    router.get('/manga/:id/:site?', require('./index'));
};
