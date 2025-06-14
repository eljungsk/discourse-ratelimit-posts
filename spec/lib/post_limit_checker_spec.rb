# frozen_string_literal: true

require 'rails_helper'

RSpec.describe DiscourseRateLimitPosts::PostLimitChecker do
  fab!(:user_tl0) { Fabricate(:user, trust_level: 0) }
  fab!(:user_tl1) { Fabricate(:user, trust_level: 1) }
  fab!(:admin) { Fabricate(:admin) }
  fab!(:moderator) { Fabricate(:moderator) }

  before do
    SiteSetting.discourse_ratelimit_posts_enabled = true
    SiteSetting.discourse_ratelimit_posts_tl0_daily_limit = 3
    SiteSetting.discourse_ratelimit_posts_tl1_daily_limit = 10
    SiteSetting.discourse_ratelimit_posts_tl2_daily_limit = 20
    SiteSetting.discourse_ratelimit_posts_tl3_daily_limit = 50
    SiteSetting.discourse_ratelimit_posts_tl4_daily_limit = 0 # unlimited
    
    Discourse.redis.flushdb
  end

  describe '.can_create_post?' do
    context 'when plugin is disabled' do
      it 'allows post creation' do
        SiteSetting.discourse_ratelimit_posts_enabled = false
        expect(described_class.can_create_post?(user_tl0)).to eq(true)
      end
    end

    context 'when user is staff' do
      it 'allows admin to create posts' do
        expect(described_class.can_create_post?(admin)).to eq(true)
      end

      it 'allows moderator to create posts' do
        expect(described_class.can_create_post?(moderator)).to eq(true)
      end
    end

    context 'when user is nil' do
      it 'allows post creation' do
        expect(described_class.can_create_post?(nil)).to eq(true)
      end
    end

    context 'for regular users' do
      it 'allows posts within limit for TL0' do
        expect(described_class.can_create_post?(user_tl0)).to eq(true)
        
        # Simulate creating 2 posts
        2.times { described_class.increment_post_count(user_tl0) }
        expect(described_class.can_create_post?(user_tl0)).to eq(true)
        
        # Third post should still be allowed
        described_class.increment_post_count(user_tl0)
        expect(described_class.can_create_post?(user_tl0)).to eq(false)
      end

      it 'allows posts within limit for TL1' do
        expect(described_class.can_create_post?(user_tl1)).to eq(true)
        
        # Simulate creating 9 posts
        9.times { described_class.increment_post_count(user_tl1) }
        expect(described_class.can_create_post?(user_tl1)).to eq(true)
        
        # 10th post should still be allowed
        described_class.increment_post_count(user_tl1)
        expect(described_class.can_create_post?(user_tl1)).to eq(false)
      end

      it 'allows unlimited posts for TL4' do
        user_tl4 = Fabricate(:user, trust_level: 4)
        expect(described_class.can_create_post?(user_tl4)).to eq(true)
        
        # Simulate creating many posts
        100.times { described_class.increment_post_count(user_tl4) }
        expect(described_class.can_create_post?(user_tl4)).to eq(true)
      end
    end
  end

  describe '.posts_remaining_today' do
    it 'returns correct remaining count for TL0' do
      expect(described_class.posts_remaining_today(user_tl0)).to eq(3)
      
      described_class.increment_post_count(user_tl0)
      expect(described_class.posts_remaining_today(user_tl0)).to eq(2)
      
      described_class.increment_post_count(user_tl0)
      expect(described_class.posts_remaining_today(user_tl0)).to eq(1)
      
      described_class.increment_post_count(user_tl0)
      expect(described_class.posts_remaining_today(user_tl0)).to eq(0)
    end

    it 'returns infinity for staff' do
      expect(described_class.posts_remaining_today(admin)).to eq(Float::INFINITY)
      expect(described_class.posts_remaining_today(moderator)).to eq(Float::INFINITY)
    end

    it 'returns infinity when plugin disabled' do
      SiteSetting.discourse_ratelimit_posts_enabled = false
      expect(described_class.posts_remaining_today(user_tl0)).to eq(Float::INFINITY)
    end
  end

  describe '.increment_post_count' do
    it 'increments post count for regular users' do
      expect(described_class.send(:posts_created_today, user_tl0)).to eq(0)
      
      described_class.increment_post_count(user_tl0)
      expect(described_class.send(:posts_created_today, user_tl0)).to eq(1)
      
      described_class.increment_post_count(user_tl0)
      expect(described_class.send(:posts_created_today, user_tl0)).to eq(2)
    end

    it 'does not increment for staff' do
      described_class.increment_post_count(admin)
      expect(described_class.send(:posts_created_today, admin)).to eq(0)
    end

    it 'does not increment when plugin disabled' do
      SiteSetting.discourse_ratelimit_posts_enabled = false
      described_class.increment_post_count(user_tl0)
      expect(described_class.send(:posts_created_today, user_tl0)).to eq(0)
    end
  end

  describe 'Redis key expiration' do
    it 'sets expiration on Redis keys' do
      described_class.increment_post_count(user_tl0)
      
      key = described_class.send(:post_count_key, user_tl0)
      ttl = Discourse.redis.ttl(key)
      
      expect(ttl).to be > 24.hours.to_i
      expect(ttl).to be <= 25.hours.to_i
    end
  end

  describe 'Category exemptions' do
    before do
      SiteSetting.discourse_ratelimit_posts_exempt_categories = "1|3|5"
    end

    describe '.can_create_post?' do
      it 'allows unlimited posts in exempt categories' do
        # Exceed the limit in a non-exempt category
        3.times { described_class.increment_post_count(user_tl0, 2) }
        expect(described_class.can_create_post?(user_tl0, 2)).to eq(false)
        
        # Should still allow posts in exempt categories
        expect(described_class.can_create_post?(user_tl0, 1)).to eq(true)
        expect(described_class.can_create_post?(user_tl0, 3)).to eq(true)
        expect(described_class.can_create_post?(user_tl0, 5)).to eq(true)
        
        # Non-exempt categories should still be blocked
        expect(described_class.can_create_post?(user_tl0, 2)).to eq(false)
        expect(described_class.can_create_post?(user_tl0, 4)).to eq(false)
      end

      it 'works with nil category_id' do
        expect(described_class.can_create_post?(user_tl0, nil)).to eq(true)
      end
    end

    describe '.posts_remaining_today' do
      it 'returns Float::INFINITY for exempt categories' do
        expect(described_class.posts_remaining_today(user_tl0, 1)).to eq(Float::INFINITY)
        expect(described_class.posts_remaining_today(user_tl0, 3)).to eq(Float::INFINITY)
        expect(described_class.posts_remaining_today(user_tl0, 5)).to eq(Float::INFINITY)
        
        # Non-exempt categories should return normal counts
        expect(described_class.posts_remaining_today(user_tl0, 2)).to eq(3)
        expect(described_class.posts_remaining_today(user_tl0, 4)).to eq(3)
      end
    end

    describe '.increment_post_count' do
      it 'does not increment count for exempt categories' do
        # Posts in exempt categories should not count toward limits
        described_class.increment_post_count(user_tl0, 1)
        described_class.increment_post_count(user_tl0, 3)
        described_class.increment_post_count(user_tl0, 5)
        
        expect(described_class.send(:posts_created_today, user_tl0)).to eq(0)
        
        # Posts in non-exempt categories should count
        described_class.increment_post_count(user_tl0, 2)
        expect(described_class.send(:posts_created_today, user_tl0)).to eq(1)
      end
    end

    describe '.category_exempt?' do
      it 'returns true for exempt categories' do
        expect(described_class.send(:category_exempt?, 1)).to eq(true)
        expect(described_class.send(:category_exempt?, 3)).to eq(true)
        expect(described_class.send(:category_exempt?, 5)).to eq(true)
      end

      it 'returns false for non-exempt categories' do
        expect(described_class.send(:category_exempt?, 2)).to eq(false)
        expect(described_class.send(:category_exempt?, 4)).to eq(false)
        expect(described_class.send(:category_exempt?, 6)).to eq(false)
      end

      it 'returns false for nil category_id' do
        expect(described_class.send(:category_exempt?, nil)).to eq(false)
      end

      it 'returns false when no exempt categories are configured' do
        SiteSetting.discourse_ratelimit_posts_exempt_categories = ""
        expect(described_class.send(:category_exempt?, 1)).to eq(false)
      end

      it 'handles string category IDs' do
        expect(described_class.send(:category_exempt?, "1")).to eq(true)
        expect(described_class.send(:category_exempt?, "3")).to eq(true)
        expect(described_class.send(:category_exempt?, "2")).to eq(false)
      end
    end
  end
end