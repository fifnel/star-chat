# coding: utf-8

require './star_chat/models'

StarChat::RedisDB.setup('127.0.0.1', 6379)

export_dir = './export/'

mode = ARGV[0]

if mode == 'chlist'
    printf("%s\t%s\t%s\n",
           :name,
           :privacy,
           :message_count )
    StarChat::Channel.all.select do |channel|
        printf("%s\t%s\t%s\n",
               channel.name,
               channel.privacy,
               channel.message_count)
    end
elsif mode == 'log'

   channel_name = ARGV[1]
   channel = StarChat::Channel.find(channel_name)

   printf("%s\t%s\t%s\t%s\t%s\n",
          :id,
          :notice,
          :time,
          :user_name,
          :body )
   channel.messages.each do |message|
       printf("%s\t%s\t%s\t%s\t%s\n",
                      message.id,
                      message.notice?,
                      Time.at(message.created_at).strftime('%Y-%m-%d %H:%M:%S'),
                      message.user_name,
                      message.body )
   end
end

