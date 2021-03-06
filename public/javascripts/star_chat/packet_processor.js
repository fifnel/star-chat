'use strict';

/**
 * @constructor
 */
starChat.PacketProcessor =  function () {
    /**
     * @type {number}
     */
    this.lastMessageId_ = 0;
};

/**
 * @private
 * @param {!Object} packet
 * @param {!starChat.View} view
 * @return {undefined}
 */
starChat.PacketProcessor.prototype.processPacketMessage = function (packet, view) {
    var message = packet.message;
    if (message && message.channel_name) {
        view.addNewMessage(message.channel_name, message, true);
        if (this.lastMessageId_ < message.id) {
            this.lastMessageId_ = message.id;
        }
    }
}

/**
 * @private
 * @param {!Object} packet
 * @param {!starChat.View} view
 * @return {undefined}
 */
starChat.PacketProcessor.prototype.processPacketSubscribing = function (packet, view) {
    var channelName = packet.channel_name;
    var userName    = packet.user_name;
    starChat.Channel.find(channelName).addUser(userName);
}

/**
 * @private
 * @param {!Object} packet
 * @param {!starChat.View} view
 * @return {undefined}
 */
starChat.PacketProcessor.prototype.processPacketDeleteSubscribing = function (packet, view) {
    var channelName = packet.channel_name;
    var userName    = packet.user_name;
    starChat.Channel.find(channelName).removeUser(userName);
}

/**
 * @private
 * @param {!Object} packet
 * @param {!starChat.View} view
 * @return {undefined}
 */
starChat.PacketProcessor.prototype.processPacketTopic = function (packet, view) {
    var topic = packet.topic;
    if (topic) {
        var channel = starChat.Channel.find(topic.channel_name);
        channel.topic(topic);
    }
}

/**
 * @private
 * @param {!Object} packet
 * @param {!starChat.View} view
 * @return {undefined}
 */
starChat.PacketProcessor.prototype.processPacketUser = function(packet, view) {
    var userObj = packet.user;
    if (userObj) {
        var user = starChat.User.find(userObj.name);
        user.update(userObj);
    }
}

/**
 * @private
 * @param {!Object} packet
 * @param {!starChat.View} view
 * @return {undefined}
 */
starChat.PacketProcessor.prototype.processPacketChannel = function (packet, view) {
    var channelObj = /** @type {{channel: {name: string}}} */packet.channel;
    if (channelObj) {
        var channel = starChat.Channel.find(channelObj.name);
        channel.update(channelObj);
    }
}

/**
 * @param {!Object} packet
 * @param {!starChat.View} view
 * @return {undefined}
 */
starChat.PacketProcessor.prototype.process = function (packet, view) {
    if (packet.type === 'message') {
        this.processPacketMessage(packet, view);
    } else if (packet.type === 'subscribing') {
        this.processPacketSubscribing(packet, view);
    } else if (packet.type === 'delete_subscribing') {
        this.processPacketDeleteSubscribing(packet, view);
    } else if (packet.type === 'user') {
        this.processPacketUser(packet, view);
    } else if (packet.type === 'channel') {
        this.processPacketChannel(packet, view);
    } else {
        console.error('Received an unknown packet:');
        console.error(packet);
    }
};

/**
 * @return {number}
 */
starChat.PacketProcessor.prototype.lastMessageId = function () {
    return this.lastMessageId_;
};
