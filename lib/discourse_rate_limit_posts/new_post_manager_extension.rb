# frozen_string_literal: true

module DiscourseRateLimitPosts
  module NewPostManagerExtension
    def perform
      # Check post limits before creating the post
      if should_check_post_limits?
        category_id = get_category_id
        unless PostLimitChecker.can_create_post?(user, category_id)
          limit = PostLimitChecker.send(:daily_limit_for_trust_level, user.trust_level)
          remaining = PostLimitChecker.posts_remaining_today(user, category_id)
          
          add_error_to_result(
            I18n.t("discourse_ratelimit_posts.daily_limit_exceeded", 
                   limit: limit, 
                   remaining: remaining,
                   trust_level: user.trust_level)
          )
          return
        end
      end
      
      # Call the original perform method
      result = super
      
      # If post was successfully created, increment the counter
      if result.success? && should_check_post_limits?
        category_id = get_category_id
        PostLimitChecker.increment_post_count(user, category_id)
      end
      
      result
    end
    
    private
    
    def should_check_post_limits?
      SiteSetting.discourse_ratelimit_posts_enabled && 
      user.present? && 
      !user.staff? && 
      !@args[:is_warning] # Don't limit warning messages
    end
    
    def add_error_to_result(message)
      result = NewPostResult.new(:created_post, false)
      result.errors.add(:base, message)
      @result = result
    end
    
    def get_category_id
      # For new topics, category_id is in @args
      return @args[:category_id] if @args[:category_id].present?
      
      # For replies, get category from the topic
      if @args[:topic_id].present?
        topic = Topic.find_by(id: @args[:topic_id])
        return topic&.category_id
      end
      
      nil
    end
  end
end