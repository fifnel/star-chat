'use strict';

starChat.Stream = (function () {
    var Stream = function () {
        this.isActive_ = false;
        this.continuingErrorNum_ = 0;
        this.packetProcessor_ = new starChat.PacketProcessor();
    };
    Stream.prototype.start = function (view) {
        if (this.isActive_) {
            return;
        }
        this.isActive_ = true;
        this.continuingErrorNum_ = 0;
        var self = this;
        var session = view.session;
        var streamReadIndex = 0;
        var url = '/users/' + encodeURIComponent(session.userName()) + '/stream';
        var callbacks = {
            onprogress: function () {
                // TODO: Reconnecting if overflow
                var xhr = this;
                var text = xhr.responseText;
                var subText = text.substring(streamReadIndex);
                while (true) {
                    var tokenLength = subText.search("\n");
                    if (tokenLength === -1) {
                        break;
                    }
                    streamReadIndex += tokenLength + 1;
                    var token = subText.substring(0, tokenLength);
                    subText = subText.substring(tokenLength + 1);
                    try {
                        var packet = JSON.parse(token);
                    } catch (e) {
                        console.log(e);
                        continue;
                    }
                    self.packetProcessor_.process(packet, view);
                }
            },
            success: function (data, textStatus, jqXHR) {
                self.continuingErrorNum_ = 0;
                setTimeout(startStream, 0);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log(textStatus);
                self.continuingErrorNum_++;
                if (10 <= self.ontinuingErrorNum_) {
                    console.log('Too many errors!');
                    // TODO: implement showing error message
                    return;
                }
                setTimeout(startStream, 10000);
            },
        };
        starChat.ajax(session.userName(), session.password(),
                      url,
                      'GET',
                      callbacks);
    };
    Stream.prototype.stop = function () {
        if (!this.isActive_) {
            return;
        }
        this.isActive_ = false;
        this.continuingErrorNum_ = 0;
    };
    return Stream;
})();
