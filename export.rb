# coding: utf-8

require './star_chat/models'

StarChat::RedisDB.setup('127.0.0.1', 6379)

export_dir = './export/'

StarChat::Channel.all.select do |channel|
    channel_info_filename = export_dir + channel.name + '_channel_info.txt'
    File.open(channel_info_filename, 'w') do |f|
        f.write(sprintf("name:%s\n", channel.name))
        f.write(sprintf("public?:%s\n", channel.public?))
    end
    
    chat_log_filename = export_dir + channel.name + '_chat_log.txt'
    File.open(chat_log_filename, 'w') do |f|
        channel.messages.each do |message|
            # TODO json? csv? ltsv??
            text = sprintf("%s : %s : %s : %s : %s\n",
                           message.id,
                           message.notice?,
                           Time.at(message.created_at).strftime('%Y-%m-%d %H:%M:%S'),
                           message.user_name,
                           message.body )
            f.write(text)
            puts text
        end
    end
end

