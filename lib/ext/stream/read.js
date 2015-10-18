'use strict';

/**
 * @method read
 * @param {Object} stream
 * @param {Function} receiver
 * @param {Boolean} [closable]
 * @param {Number} [readSize]
 * @returns {Promise}
 */
function read(stream, receiver, closable, readSize) {

    if (!$utils.isReadableStream(stream)) {
        throw new TypeError("Readable stream is required.");
    }

    if (typeof receiver !== 'function') {
        throw new TypeError("Invalid stream receiver.");
    }

    readSize = (readSize > 0) ? parseInt(readSize) : null;

    var self = this, reads = 0, size = 0, start = Date.now(),
        index = 0, cbTime, ready, waiting, stop;

    return $p(function (resolve, reject) {

        function onReadable() {
            ready = true;
            process();
        }

        function onEnd() {
            if (!closable) {
                finish();
            }
        }

        function onClose() {
            if (closable) {
                finish();
            }
        }

        function onError(error) {
            stop = true;
            cleanup();
            reject(error);
        }

        stream.on('readable', onReadable);
        stream.on('end', onEnd);
        stream.on('close', onClose);
        stream.on('error', onError);

        function process() {
            if (!ready || stop || waiting) {
                return;
            }
            ready = false;
            waiting = true;
            var page, data = [];
            do {
                page = stream.read(readSize);
                if (page) {
                    data.push(page);
                    size += page.length;
                    reads++;
                }
            } while (page);

            if (!data.length) {
                waiting = false;
                return;
            }

            var result, cbNow = Date.now(),
                cbDelay = index ? (cbNow - cbTime) : undefined;
            cbTime = cbNow;
            try {
                result = receiver.call(self, index++, data, cbDelay);
            } catch (e) {
                stop = true;
                reject(e);
                return;
            }

            if ($utils.isPromise(result)) {
                result.then(function () {
                    waiting = false;
                    process();
                }, function (reason) {
                    stop = true;
                    reject(reason);
                });

            } else {
                waiting = false;
                process();
            }
        }

        function finish() {
            cleanup();
            resolve({
                calls: index,
                reads: reads,
                size: size,
                duration: Date.now() - start
            });
        }

        function cleanup() {
            stream.removeListener('readable', onReadable);
            stream.removeListener('close', onClose);
            stream.removeListener('error', onError);
            stream.removeListener('end', onEnd);
        }
    });
}

var $utils, $p;

module.exports = function (config) {
    $utils = config.utils;
    $p = config.promise;
    return read;
};