# frozen_string_literal: true

module DiscourseRateLimitPosts
  class PostLimitChecker
    def self.can_create_post?(user, category_id = nil)
      return true unless SiteSetting.discourse_ratelimit_posts_enabled
      return true if user.nil? || user.staff?
      return true if category_exempt?(category_id)
      
      limit = daily_limit_for_trust_level(user.trust_level)
      return true if limit == 0 # 0 means unlimited
      
      current_count = posts_created_today(user)
      current_count < limit
    end
    
    def self.posts_remaining_today(user, category_id = nil)
      return Float::INFINITY unless SiteSetting.discourse_ratelimit_posts_enabled
      return Float::INFINITY if user.nil? || user.staff?
      return Float::INFINITY if category_exempt?(category_id)
      
      limit = daily_limit_for_trust_level(user.trust_level)
      return Float::INFINITY if limit == 0 # 0 means unlimited
      
      current_count = posts_created_today(user)
      [limit - current_count, 0].max
    end
    
    def self.increment_post_count(user, category_id = nil)
      return unless SiteSetting.discourse_ratelimit_posts_enabled
      return if user.nil? || user.staff?
      return if category_exempt?(category_id)
      
      redis_key = post_count_key(user)
      Discourse.redis.multi do |multi|
        multi.incr(redis_key)
        multi.expire(redis_key, 25.hours.to_i) # 25 hours to handle timezone edge cases
      end
    end
    
    private
    
    def self.daily_limit_for_trust_level(trust_level)
      case trust_level
      when 0
        SiteSetting.discourse_ratelimit_posts_tl0_daily_limit
      when 1
        SiteSetting.discourse_ratelimit_posts_tl1_daily_limit
      when 2
        SiteSetting.discourse_ratelimit_posts_tl2_daily_limit
      when 3
        SiteSetting.discourse_ratelimit_posts_tl3_daily_limit
      when 4
        SiteSetting.discourse_ratelimit_posts_tl4_daily_limit
      else
        0 # No limit for unknown trust levels
      end
    end
    
    def self.posts_created_today(user)
      redis_key = post_count_key(user)
      count = Discourse.redis.get(redis_key)
      count ? count.to_i : 0
    end
    
    def self.post_count_key(user)
      date = Time.zone.now.strftime('%Y-%m-%d')
      "discourse_ratelimit_posts:user:#{user.id}:date:#{date}"
    end
    
    def self.category_exempt?(category_id)
      return false if category_id.nil?
      
      exempt_categories = SiteSetting.discourse_ratelimit_posts_exempt_categories
      return false if exempt_categories.blank?
      
      exempt_category_ids = exempt_categories.split('|').map(&:to_i)
      exempt_category_ids.include?(category_id.to_i)
    end
  end
end