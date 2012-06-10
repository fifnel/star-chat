'use strict';

starChat.View = (function () {
    var View = function (sessionClass) {
        this.sessionClass_ = sessionClass;

        initialize(this);
    };
    function initialize(self) {
        self.session_ = new self.sessionClass_();

        // TODO: Model に相当するクラスを作る?
        // TODO: いずれこれらの変数も private (_ 終わり) にする
        self.channelName = '';

        self.lastChannelName_ = '';
        self.newMessages_ = {};
        self.pseudoMessages_ = {};
        self.messageElements_ = {};
        self.messageIdsAlreadyInSection_ = {};
        self.messageScrollTops_ = {};
        self.isScrolling_ = false;
        self.dirtyFlags_ = {};
        self.startTime_ = null;
        self.endTime_ = null;
        self.oldMessages_ = {};
        self.isBlinkingTitle_ = false;
        self.searchQuery_ = null;
        self.searchResult_ = [];
        self.isEdittingTopic_ = false;
        self.errorMessages_ = {};

        // Dialogs
        self.isEdittingUser_ = false;
        self.isEdittingChannels_ = false;
        self.isEdittingChannel_ = false;
        self.edittingChannelName_ = false;
        self.isShowingInvitationURLDialog_ = false;

        self.title_ = 'StarChat (β)';
        document.title = self.title_;
        stopBlinkingTitle(self);
    }
    function startBlinkingTitle(self) {
        if (self.isBlinkingTitle_) {
            return;
        }
        self.isBlinkingTitle_ = true;
        function loop (i) {
            if (!self.isBlinkingTitle_) {
                stopBlinkingTitle(self);
                return;
            }
            if (starChat.isFocused()) {
                stopBlinkingTitle(self);
                return;
            }
            document.title = {
                0: self.title_,
                1: '(*) ' + self.title_
            }[i];
            setTimeout(function () {
                loop(1 - i);
            }, 1000);
        }
        loop(0);
    }
    function stopBlinkingTitle(self) {
        self.isBlinkingTitle_ = false;
        document.title = self.title_;
    }
    var updateViewChannels = (function () {
        var lastSessionId = 0;
        return function (self) {
            var channels = [];
            if (self.session().isLoggedIn()) {
                channels = self.session().user().channels().sort(function (a, b) {
                    if (a.name() > b.name()) {
                        return 1;
                    }
                    if (a.name() < b.name()) {
                        return -1;
                    }
                    return 0;
                });
            }
            if (self.channelName) {
                self.dirtyFlags_[self.channelName] = false;
            }
            (function () {
                var ul = $('#channelsList');
                ul.find('li').filter(function (i) {
                    var channelName = $(this).attr('data-channel-name');
                    return channels.every(function (channel) {
                        return channel.name() !== channelName;
                    });
                }).remove();
                var existChannelNames = $.map(ul.find('li'), function (e) {
                    return $(e).attr('data-channel-name');
                });
                var newChannels = channels.filter(function (channel) {
                    return existChannelNames.every(function (name) {
                        return name !== channel.name();
                    });
                });
                // TODO: sort
                newChannels.forEach(function (channel) {
                    var a = $('<a></a>');
                    var name = channel.name();
                    var href = '#channels/' + encodeURIComponent(channel.name());
                    a.attr('href', href);
                    a.text(name);
                    var li = $('<li></li>').attr('data-channel-name', channel.name());
                    li.append(a);
                    ul.append(li);
                });
                ul.find('li').each(function () {
                    var e = $(this);
                    var channelName = e.attr('data-channel-name');
                    e.find('a').toggleClass('dirty', self.dirtyFlags_[channelName] === true);
                });
                lastSessionId = self.session_.id();
            })();
        }
    })();
    function updateViewSearch(self) {
        var ul = $('#searchResultList');
        ul.empty();
        self.searchResult_.forEach(function (result) {
            var message = result.message;

            var li = $('<li></li>');
            var createdAt = new Date(message.created_at * 1000);
            var createdAtStr = starChat.toISO8601(createdAt, 'date') + ' ' +
                starChat.toISO8601(createdAt, 'hourMinute');
            var createdAtE = $('<time></time>').append(createdAtStr);
            createdAtE.attr('datetime', starChat.toISO8601(createdAt));

            var userName = message.user_name;
            var userNameE = $('<span></span>').text(userName).addClass('userName');

            var bodyE = $(document.createTextNode(message.body));

            var time = new Date(message.created_at * 1000);
            time.setHours(0);
            time.setMinutes(0);
            time.setSeconds(0);
            time.setMilliseconds(0);
            var startTime = starChat.parseInt(time.getTime() / 1000);
            var endTime   = startTime + 60 * 60 * 24;
            var channelNameLink = $('<a></a>').text(message.channel_name);
            var channelUrl = '#channels/' + encodeURIComponent(message.channel_name) +
                '/old_logs/by_time_span/' + startTime + ',' + endTime;
            channelNameLink.attr('href', channelUrl);
            // TODO: highlight

            li.append(createdAtE);
            li.append($('<br />'));
            li.append(userNameE);
            li.append($('<br />'));
            li.append(bodyE);
            li.append($(document.createTextNode(' (')));
            li.append(channelNameLink);
            li.append($(document.createTextNode(')')));
            ul.append(li);
        });
    }
    function getSectionElement(self) {
        if (!self.channelName) {
            return $('#messages > section[data-channel-name=""]');
        }
        var sections = $('#messages > section').filter(function (i) {
            return $(this).attr('data-channel-name') === self.channelName &&
                (!self.isShowingOldLogs() &&
                 !$(this).attr('data-start-time') &&
                 !$(this).attr('data-end-time')) ||
                (self.isShowingOldLogs() &&
                 starChat.parseInt(String($(this).attr('data-start-time'))) === self.startTime_ &&
                 starChat.parseInt(String($(this).attr('data-end-time')))   === self.endTime_);
        });
        if (sections.length === 1) {
            var section = sections;
            section.find('[name="year"]').val('');
            section.find('[name="month"]').val('');
            section.find('[name="day"]').val('');
            return section;
        }
        if (2 <= sections.length) {
            throw 'invalid sections';
        }
        var section = $('<section></section>');
        var channelName = self.channelName;
        section.attr('data-channel-name', channelName);
        if (self.isShowingOldLogs()) {
            section.attr('data-start-time', self.startTime_);
            section.attr('data-end-time',   self.endTime_);
        }
        if (!self.isShowingOldLogs()) {
            section.scroll(function () {
                if (self.channelName !== channelName) {
                    return;
                }
                self.messageScrollTops_[channelName] = section.scrollTop();
            });
        }
        $('#messages h2').after(section);
        return section;
    }
    /**
     * @param {Object} message
     * @param {Array.<string>=} keywords
     */
    function messageToElement(message, keywords) {
        var messageTR = $('<tr></tr>').addClass('message');

        var time = new Date();
        time.setTime(message.created_at * 1000);
        var h = time.getHours() + '';
        var m = time.getMinutes() + '';
        if (h.length < 2) {
            h = '0' + h;
        }
        if (m.length < 2) {
            m = '0' + m;
        }
        var timeStr = h + ':' + m;
        var createdAtTD = $('<td></td>');
        var createdAtTime = $('<time></time>').text(timeStr).attr('data-unix-time', message.created_at);
        createdAtTD.append(createdAtTime).addClass('createdAt');
        messageTR.append(createdAtTD);

        var user = starChat.User.find(message.user_name);
        var userNameTD = $('<td></td>').text(user.nick()).attr('title', user.name());
        userNameTD.addClass('userName');
        messageTR.append(userNameTD);

        var bodyTD = $('<td></td>').addClass('body').text(message.body);
        if (message.notice) {
            bodyTD.addClass('notice');
        }
        starChat.replaceURLWithLinks(bodyTD);

        var emphasizedNum = 0;
        if (keywords !== void(0) && !message.notice) {
            keywords.forEach(function (keyword) {
                emphasizedNum += starChat.emphasizeKeyword(bodyTD, keyword);
            });
        }
        starChat.replaceBreakLines(bodyTD);
        messageTR.append(bodyTD);

        messageTR.attr('data-message-id', message.id);
        messageTR.data('emphasizedNum', emphasizedNum);
        return messageTR;
    }
    function updateViewMessages(self) {
        if (self.channelName) {
            var h2 = $('#messages h2');
            if (self.isShowingOldLogs()) {
                var d = new Date(self.startTime_ * 1000);
                if ((self.endTime_ - self.startTime_) === 60 * 60 * 24 &&
                    d.getHours() === 0 &&
                    d.getMinutes() === 0 &&
                    d.getSeconds() === 0) {
                    var startTime = starChat.toISO8601(new Date(self.startTime_ * 1000), 'date');
                    var oldLogs = '(Old Logs: ' + startTime + ')';
                } else {
                    var startTime = starChat.toISO8601(new Date(self.startTime_ * 1000));
                    var endTime   = starChat.toISO8601(new Date(self.endTime_   * 1000));
                    var oldLogs = '(Old Logs: ' + startTime + '/' + endTime + ')';
                }
                h2.find('span').text(self.channelName + ' ' + oldLogs);
            } else {
                h2.find('span').text(self.channelName);
            }
            var channel = starChat.Channel.find(self.channelName);
            if (channel.privacy() === 'private') {
                h2.find('img[alt="private"]').show();
            } else {
                h2.find('img[alt="private"]').hide();
            }
        } else {
            var h2 = $('#messages h2');
            h2.find('span').text("\u00a0");
            h2.find('img[alt="private"]').hide();
        }
        if (!self.isShowingOldLogs()) {
            $('#messages > section').filter(function (i) {
                return $(this).attr('data-start-time') || $(this).attr('data-end-time');
            }).remove();
        }
        var section = getSectionElement(self);
        $('#messages > section').each(function () {
            var e = $(this);
            if (e.get(0) === section.get(0)) {
                e.show();
            } else {
                e.hide();
            }
        });
        var hitKeyword = false;
        Object.keys(self.newMessages_).forEach(function (channel) {
            self.newMessages_[channel].forEach(function (message) {
                if (message.id in self.messageElements_) {
                    return;
                }
                var keywords = [];
                var user = self.session().user();
                if (message.user_name !== user.name()) {
                    keywords = user.keywords();
                }
                var e = messageToElement(message, keywords);
                self.messageElements_[message.id] = e;
                hitKeyword |= (0 < e.data('emphasizedNum'));
            });
        });
        if (hitKeyword && !starChat.isFocused()) {
            startBlinkingTitle(self);
        }
        self.title_ = 'StarChat (β)';
        if (self.channelName) {
            self.title_ += ' - ' + self.channelName;
            if (!self.isBlinkingTitle_) {
                document.title = self.title_;
            }
        }

        if (!self.channelName) {
            self.lastChannelName_ = '';
            return;
        }

        // isBottom should be gotten before appending new message elements
        var diff = (section.get(0).scrollHeight - section.scrollTop()) -
            section.outerHeight();
        var isBottom = diff < 100;

        // TODO: sort by id
        var table = section.find('table.messages');
        if (table.length === 0) {
            table = $('<table></table>').addClass('messages');
            // A dummy TR is needed because the first TR defines the layout of the table.
            var tr = $('<tr></tr>').addClass('message');
            tr.append($('<td></td>').addClass('createdAt'));
            tr.append($('<td></td>').addClass('userName'));
            tr.append($('<td></td>').addClass('body'));
            tr.css('height', 0);
            table.append(tr);
            section.append(table);
        }
        if (!self.isShowingOldLogs()) {
            if (self.channelName in self.newMessages_) {
                var lastUNIXTime = table.find('tr.message').
                    not('[data-pseudo-message-id]').find('time').
                    last().attr('data-unix-time');
                var msgs = self.newMessages_[self.channelName];
                msgs.forEach(function (message) {
                    if (message.id in self.messageIdsAlreadyInSection_) {
                        return;
                    }
                    self.messageIdsAlreadyInSection_[message.id] = true;
                    var lastDateStr = null;
                    if (lastUNIXTime) {
                        lastDateStr = starChat.toISO8601(lastUNIXTime, 'date');
                    }
                    var nextDateStr = starChat.toISO8601(message.created_at, 'date');
                    if (!lastDateStr || (lastDateStr !== nextDateStr)) {
                        var tr = $('<tr></tr>').addClass('date');
                        var td = $('<td></td>').attr('colspan', '3').text(nextDateStr);
                        tr.append(td);
                        table.append(tr);
                    }
                    table.append(self.messageElements_[message.id]);
                    lastUNIXTime = message.created_at;
                });
                self.newMessages_[self.channelName] = [];
            }
            if (self.channelName in self.pseudoMessages_) {
                var messages = self.pseudoMessages_[self.channelName];
                messages.forEach(function (message) {
                    var e = messageToElement(message);
                    e.attr('data-pseudo-message-id', message.pseudo_message_id)
                    table.append(e);
                });
                self.pseudoMessages_[self.channelName] = [];
            }
        } else {
            var key = self.startTime_ + '_' + self.endTime_;
            if (self.channelName in self.oldMessages_ &&
                key in self.oldMessages_[self.channelName]) {
                // TODO: Refactoring
                table.empty();
                var msgs = self.oldMessages_[self.channelName][key];
                msgs.forEach(function (message) {
                    table.append(messageToElement(message, []));
                });
            }
        }

        $('[data-pseudo-message-id]').filter('[data-removed="true"]').remove();

        if (!self.isShowingOldLogs() && !self.isScrolling_) {
            self.isScrolling_ = true;
            // Manipurate the scrool top after elements are set completely.
            setTimeout(function () {
                if (self.lastChannelName_ === self.channelName &&
                    isBottom) {
                    section.animate({scrollTop: section.get(0).scrollHeight}, {
                        duration: 750,
                        complete: function () {
                            self.messageScrollTops_[self.channelName] = section.scrollTop();
                            self.lastChannelName_ = self.channelName;
                            self.isScrolling_ = false;
                        }
                    });
                } else {
                    if (!self.lastChannelName_ ||
                        !(self.channelName in self.messageScrollTops_)) {
                        section.scrollTop(section.get(0).scrollHeight);
                    } else {
                        section.scrollTop(self.messageScrollTops_[self.channelName]);
                    }
                    self.messageScrollTops_[self.channelName] = section.scrollTop();
                    self.lastChannelName_ = self.channelName;
                    self.isScrolling_ = false;
                }
            }, 0);
        }
    }
    function updateViewTopic(self) {
        var form = $('#updateTopicForm');
        if (self.channelName) {
            if (self.isEdittingTopic()) {
                $('#topic').hide();
                form.show();
            } else {
                $('#topic').show();
                form.hide();
            }
            var channel = starChat.Channel.find(self.channelName);
            var topic   = channel.topic();
            if (topic && topic.body) {
                var topicE = $('#topic').text(topic.body);
                starChat.replaceURLWithLinks(topicE);
                starChat.replaceBreakLines(topicE);
                form.find('[name="body"]').val(topic.body);
            } else {
                $('#topic').text('(No Topic)');
                form.find('[name="body"]').val('');
            }
        } else {
            $('#topic').hide();
            form.hide();
            $('#topic').text('');
            form.find('[name="body"]').val('');
        }
    }
    function updateViewUsers(self) {
        var ul = $('#users');
        ul.empty();
        if (self.channelName) {
            var channel = starChat.Channel.find(self.channelName);
            var users = channel.users().sort(function (a, b) {
                if (a.nick() > b.nick()) {
                    return 1;
                }
                if (a.nick() < b.nick()) {
                    return -1;
                }
                return 0;
            });
            users.forEach(function (user) {
                var li = $('<li></li>');
                li.text(user.nick()).attr('title', user.name());
                ul.append(li);
            });
            if (channel.privacy() === 'private') {
                $('#invitationLink').show();
            } else {
                $('#invitationLink').hide();
            }
        } else {
            $('#invitationLink').hide();
        }
    }
    function updateViewTimeline(self) {
        if (!self.channelName) {
            return;
        }
        var channel = starChat.Channel.find(self.channelName);
        var firstMessage = channel.firstMessage();
        if (!firstMessage) {
            return;
        }

        var firstDate = new Date(firstMessage.created_at * 1000);
        var firstYear  = Math.floor(firstDate.getFullYear());
        var firstMonth = Math.floor(firstDate.getMonth()) + 1;
        var firstYM    = firstYear * 100 + firstMonth;
        
        var today = new Date();
        var todayYear  = Math.floor(today.getFullYear());
        var todayMonth = Math.floor(today.getMonth()) + 1;
        var todayYM    = todayYear * 100 + todayMonth;

        function ymToUNIXTime(ym, day) {
            if (day === void(0)) {
                day = 1;
            }
            return Math.floor(new Date(ym / 100, ym % 100 - 1, day).getTime() / 1000);
        }
        
        var ul = $('#timeline');
        ul.empty();
        for (var ym = firstYM;
             ym <= todayYM;) {
            var nextYM = ym + 1;
            if (13 <= (nextYM % 100)) {
                nextYM = (Math.floor(ym / 100) + 1) * 100 + 1;
            }
            try {
                var text = String(ym).substr(0, 4) + '-' + String(ym).substr(4);
                var a = $('<a></a>').text(text);
                if (ym === firstYM) {
                    var startTime = ymToUNIXTime(ym, firstDate.getDate());
                } else {
                    var startTime = ymToUNIXTime(ym, 1);
                }
                var endTime   = startTime + 60 * 60 * 24;
                var href = '#channels/' + encodeURIComponent(channel.name()) +
                    '/old_logs/by_time_span/' + startTime + ',' + endTime;
                a.attr('href', href);
                var li = $('<li></li>').append(a);
                if (startTime <= self.startTime_ &&
                    self.startTime_ < ymToUNIXTime(nextYM, 1)) {
                    var currentMonth = ym % 100;
                    var ul2 = $('<ul></ul>');
                    for (;
                         (new Date(startTime * 1000)).getMonth() + 1 === currentMonth &&
                         startTime <= (today.getTime() / 1000);
                        ) {
                        try {
                            var li2 = $('<li></li>');
                            text = starChat.toISO8601(new Date(startTime * 1000), 'date');
                            var a = $('<a></a>').text(text);
                            var href = '#channels/' + encodeURIComponent(channel.name()) +
                                '/old_logs/by_time_span/' + startTime + ',' + endTime;
                            a.attr('href', href);
                            li2.append(a);
                            ul2.append(li2);
                        } finally {
                            startTime += 60 * 60 * 24;
                            endTime   += 60 * 60 * 24;
                        }
                    }
                    li.append(ul2);
                }
                ul.append(li);
            } finally {
                ym = nextYM;
            }
        }
        var href = '#channels/' + encodeURIComponent(channel.name());
        var a = $('<a></a>').text('Now').attr('href', href);
        var li = $('<li></li>').append(a);
        ul.append(li);
    }
    function updateViewDialogs(self) {
        $('.dialog').hide();
        var dialogIsShown = false;
        if (self.isEdittingUser()) {
            $('#editUserDialog').show();
            $('#editUserDialog [title="name"]').text(self.session().userName());
            var user = self.session().user();
            $('#editUserDialog [name="nick"]').val(user.nick());
            var val = user.keywords().join('\n');
            $('#editUserDialog [name="keywords"]').val(val); // Move to the view?
            dialogIsShown = true;
        }
        if (self.isEdittingChannels()) {
            $('#editChannelsDialog').show();
            var channels = self.session().user().channels();
            channels = channels.sort(function (a, b) {
                if (a.name() > b.name()) {
                    return 1;
                }
                if (a.name() < b.name()) {
                    return -1;
                }
                return 0;
            });
            var table = $('#editChannelsDialog h2 ~ table');
            var origTR = table.find('tr.cloneMe').hide();
            table.find('tr.cloned').not(origTR).remove();
            channels.forEach(function (channel) {
                var tr = origTR.clone(true).removeClass('cloneMe').addClass('cloned').show();
                tr.find('.channelName').text(channel.name());
                tr.find('.toolIcon').attr('data-channel-name', channel.name());
                table.append(tr);
            });
            dialogIsShown = true;
        }
        if (self.isEdittingChannel()) {
            var channelName = self.edittingChannelName();
            var channel = starChat.Channel.find(channelName);
            $('#editChannelDialog [title="channelName"]').text(channel.name());
            $('#editChannelDialog [name="privacy"]').val(['public']);
            if (channel.privacy() === 'private') {
                $('#editChannelDialog [name="privacy"]').val(['private']);
            }
            $('#editChannelDialog').show();
            dialogIsShown = true;
        } else {
            $('#editChannelDialog').hide();
        }
        if (self.isShowingInvitationURLDialog()) {
            dialogIsShown = true;
            $('#invitationURLDialog').show();
        } else {
            $('#invitationURLDialog').hide();
        }
        if (dialogIsShown) {
            $('#dialogBackground').show();
        } else {
            $('#dialogBackground').hide();
        }
    }
    View.prototype.update = function () {
        if (this.session_.isLoggedIn()) {
            $('#logInForm').hide();
            $('#logOutLink span').text(this.session_.userName());
            $('#logOutLink').show();
            $('#main').find('input, textarea').removeAttr('disabled');
            if (this.channelName && !this.isShowingOldLogs()) {
                $('#postMessageForm, #updateTopicForm').find('input, textarea').removeAttr('disabled');
            } else {
                $('#postMessageForm, #updateTopicForm').find('input, textarea').attr('disabled', 'disabled');
            }
        } else {
            $('#logInForm').show();
            $('#logOutLink').hide();
            $('#main').find('input, textarea').attr('disabled', 'disabled');
        }
        updateViewChannels(this);
        updateViewSearch(this);
        updateViewMessages(this);
        updateViewTopic(this);
        updateViewUsers(this);
        updateViewTimeline(this);
        updateViewDialogs(this);
        $('img[data-image-icon-name]').each(function () {
            var e = $(this);
            if (e.attr('src')) {
                return true;
            }
            var iconName = e.attr('data-image-icon-name');
            e.attr('src', starChat.Icons[iconName]);
        });

        $('a').filter(function () {
            var href = $(this).attr('href');
            var match = href.match(/^([a-zA-Z1-9+.-]+):/);
            if (!match) {
                return false;
            }
            var schema = match[1];
            if (!schema.match(/^https?$/)) {
                return true;
            }
            match = href.match(/^([a-zA-Z1-9+.-]+):\/\/([^\/]+)\//);
            // This may include a user and a pass, but they are ignored.
            var login = match[2];
            if (schema + ':' === location.protocol &&
                login === location.host) {
                return false;
            }
            return true;
        }).attr('target', '_blank').attr('rel', 'noreferrer');

        $(window).resize();
    };
    View.prototype.logIn = function (userName, password) {
        this.session_ = new this.sessionClass_($.now(), userName, password);
    };
    View.prototype.logOut = function () {
        this.session_ = new this.sessionClass_();
        initialize(this);
    };
    View.prototype.session = function () {
        return this.session_;
    };
    // TODO: Is channelName needed?
    View.prototype.addNewMessage = function (channelName, message, setDirtyFlag) {
        if (!this.newMessages_[channelName]) {
            this.newMessages_[channelName] = [];
        }
        if (message.id in this.messageIdsAlreadyInSection_) {
            return;
        }
        this.newMessages_[channelName].push(message);
        if (setDirtyFlag &&
            channelName !== this.channelName &&
            message.user_name !== this.session().user().name()) {
            this.setDirtyFlag(channelName, true);
        }
        // TODO: Emphasize channel name?
        if (message.user_name === this.session().user().name()) {
            var body = message.body;
            var id = $('[data-pseudo-message-id]').filter(function () {
                var e = $(this);
                if (e.attr('data-removed') === 'true') {
                    return false;
                }
                var body1 = e.find('.body').text();
                var e = $('<div></div>').text(body);
                starChat.replaceURLWithLinks(e);
                starChat.replaceBreakLines(e);
                var body2 = e.text();
                return body1 === body2;
            }).first().attr('data-pseudo-message-id');
            this.removePseudoMessage(id);
        }
    };
    View.prototype.addPseudoMessage = function (message) {
        if (!(message.channel_name in this.pseudoMessages_)) {
            this.pseudoMessages_[message.channel_name] = [];
        }
        this.pseudoMessages_[message.channel_name].push(message);
    };
    View.prototype.removePseudoMessage = function (id) {
        $('[data-pseudo-message-id=' + starChat.parseInt(id) + ']').attr('data-removed', 'true');
    };
    View.prototype.setDirtyFlag = function (channelName, value) {
        this.dirtyFlags_[channelName] = value;
    };
    View.prototype.resetTimeSpan = function () {
        this.startTime_ = null;
        this.endTime_   = null;
    };
    View.prototype.setTimeSpan = function (startTime, endTime) {
        this.startTime_ = startTime;
        this.endTime_   = endTime;
    };
    View.prototype.isShowingOldLogs = function () {
        return $.isNumeric(this.startTime_) && $.isNumeric(this.endTime_);
    };
    View.prototype.setOldMessages = function (channelName, startTime, endTime, messages) {
        if (!(channelName in this.oldMessages_)) {
            this.oldMessages_[channelName] = {};
        }
        var key = startTime + '_' + endTime;
        this.oldMessages_[channelName][key] = messages;
    };
    View.prototype.isEdittingUser = function (value) {
        if (value !== void(0)) {
            this.isEdittingUser_ = value;
            return this;
        } else {
            return this.isEdittingUser_;
        }
    };
    View.prototype.isEdittingChannels = function (value) {
        if (value !== void(0)) {
            this.isEdittingChannels_ = value;
            return this;
        } else {
            return this.isEdittingChannels_;
        }
    };
    View.prototype.isEdittingChannel = function (value) {
        if (value !== void(0)) {
            this.isEdittingChannel_ = value;
            return this;
        } else {
            return this.isEdittingChannel_;
        }
    };
    View.prototype.edittingChannelName = function (value) {
        if (value !== void(0)) {
            this.edittingChannelName_ = value;
            return this;
        } else {
            return this.edittingChannelName_;
        }
    }
    View.prototype.isShowingInvitationURLDialog = function (value) {
        if (value !== void(0)) {
            this.isShowingInvitationURLDialog_ = value;
            return this;
        } else {
            return this.isShowingInvitationURLDialog_;
        }
    };
    View.prototype.closeDialogs = function () {
        this.isEdittingUser(false);
        this.isEdittingChannels(false);
        this.isEdittingChannel(false);
        this.isShowingInvitationURLDialog(false);
    };
    View.prototype.setSearch = function (query, result) {
        this.searchQuery_  = query;
        this.searchResult_ = result;
    };
    View.prototype.clearSearch = function () {
        this.searchQuery_  = null;
        this.searchResult_ = [];
    };
    View.prototype.isEdittingTopic = function (value) {
        if (value !== void(0)) {
            this.isEdittingTopic_ = value;
            return this;
        } else {
            return this.isEdittingTopic_;
        }
    };
    View.prototype.setErrorMesasge = function (x, message) {
        this.errorMessages_[x] = message;
    };
    return View;
})();
