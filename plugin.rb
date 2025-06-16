# frozen_string_literal: true

# name: discourse-ratelimit-posts
# about: Rate limits the number of posts users can create per day based on trust level
# meta_topic_id: TODO
# version: 0.1.0
# authors: Discourse
# url: https://github.com/discourse/discourse-ratelimit-posts
# required_version: 2.7.0

enabled_site_setting :discourse_ratelimit_posts_enabled

module ::DiscourseRateLimitPosts
  PLUGIN_NAME = "discourse-ratelimit-posts"
end

require_relative "lib/discourse_rate_limit_posts/engine"

after_initialize do
  require_relative "lib/discourse_rate_limit_posts/post_limit_checker"
  require_relative "lib/discourse_rate_limit_posts/new_post_manager_extension"
  
  # Extend NewPostManager to check post limits
  NewPostManager.prepend DiscourseRateLimitPosts::NewPostManagerExtension
end
