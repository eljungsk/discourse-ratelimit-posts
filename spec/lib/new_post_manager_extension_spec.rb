# frozen_string_literal: true

require 'rails_helper'

RSpec.describe DiscourseRateLimitPosts::NewPostManagerExtension do
  fab!(:user_tl0) { Fabricate(:user, trust_level: 0) }
  fab!(:admin)
  fab!(:topic)

  before do
    SiteSetting.discourse_ratelimit_posts_enabled = true
    SiteSetting.discourse_ratelimit_posts_tl0_daily_limit = 2
    Discourse.redis.flushdb
  end

  describe 'post creation' do
    let(:valid_post_args) do
      {
        user: user_tl0,
        raw: 'This is a test post',
        topic_id: topic.id
      }
    end

    context 'when user is within limits' do
      it 'allows post creation and increments counter' do
        manager = NewPostManager.new(user_tl0, valid_post_args)
        result = manager.perform
        
        expect(result.success?).to eq(true)
        expect(PostLimits::PostLimitChecker.send(:posts_created_today, user_tl0)).to eq(1)
      end
    end

    context 'when user exceeds limits' do
      it 'prevents post creation when limit is exceeded' do
        # Create posts up to the limit
        2.times do
          manager = NewPostManager.new(user_tl0, valid_post_args)
          result = manager.perform
          expect(result.success?).to eq(true)
        end

        # Try to create one more post - should fail
        manager = NewPostManager.new(user_tl0, valid_post_args)
        result = manager.perform
        
        expect(result.success?).to eq(false)
        expect(result.errors.full_messages.first).to include('daily post limit')
      end
    end

    context 'when user is staff' do
      it 'allows unlimited posts for admin' do
        valid_post_args[:user] = admin
        
        # Create many posts - should all succeed
        5.times do
          manager = NewPostManager.new(admin, valid_post_args)
          result = manager.perform
          expect(result.success?).to eq(true)
        end
      end
    end

    context 'when plugin is disabled' do
      it 'allows all posts when plugin disabled' do
        SiteSetting.discourse_ratelimit_posts_enabled = false
        
        # Should be able to create many posts
        5.times do
          manager = NewPostManager.new(user_tl0, valid_post_args)
          result = manager.perform
          expect(result.success?).to eq(true)
        end
      end
    end

    context 'when creating warning messages' do
      it 'does not limit warning messages' do
        # First exhaust the limit
        2.times do
          manager = NewPostManager.new(user_tl0, valid_post_args)
          result = manager.perform
          expect(result.success?).to eq(true)
        end

        # Warning message should still work
        warning_args = valid_post_args.merge(is_warning: true)
        manager = NewPostManager.new(user_tl0, warning_args)
        result = manager.perform
        
        expect(result.success?).to eq(true)
      end
    end

    context 'with category exemptions' do
      fab!(:exempt_category) { Fabricate(:category) }
      fab!(:regular_category) { Fabricate(:category) }
      fab!(:exempt_topic) { Fabricate(:topic, category: exempt_category) }
      fab!(:regular_topic) { Fabricate(:topic, category: regular_category) }

      before do
        SiteSetting.discourse_ratelimit_posts_exempt_categories = exempt_category.id.to_s
      end

      it 'allows unlimited posts in exempt categories' do
        # Exhaust limit in regular category
        2.times do
          manager = NewPostManager.new(user_tl0, valid_post_args.merge(topic_id: regular_topic.id))
          result = manager.perform
          expect(result.success?).to eq(true)
        end

        # Should be blocked in regular category
        manager = NewPostManager.new(user_tl0, valid_post_args.merge(topic_id: regular_topic.id))
        result = manager.perform
        expect(result.success?).to eq(false)

        # Should still work in exempt category
        manager = NewPostManager.new(user_tl0, valid_post_args.merge(topic_id: exempt_topic.id))
        result = manager.perform
        expect(result.success?).to eq(true)
      end

      it 'allows creating topics in exempt categories even when at limit' do
        # Exhaust limit
        2.times do
          manager = NewPostManager.new(user_tl0, valid_post_args)
          result = manager.perform
          expect(result.success?).to eq(true)
        end

        # Should be blocked for regular category
        topic_args = {
          user: user_tl0,
          raw: 'New topic content',
          title: 'New Topic',
          category_id: regular_category.id
        }
        manager = NewPostManager.new(user_tl0, topic_args)
        result = manager.perform
        expect(result.success?).to eq(false)

        # Should work for exempt category
        exempt_topic_args = topic_args.merge(category_id: exempt_category.id)
        manager = NewPostManager.new(user_tl0, exempt_topic_args)
        result = manager.perform
        expect(result.success?).to eq(true)
      end

      it 'does not count posts in exempt categories toward limits' do
        # Create many posts in exempt category
        5.times do
          manager = NewPostManager.new(user_tl0, valid_post_args.merge(topic_id: exempt_topic.id))
          result = manager.perform
          expect(result.success?).to eq(true)
        end

        # Should still be able to post in regular category (limit not reached)
        manager = NewPostManager.new(user_tl0, valid_post_args.merge(topic_id: regular_topic.id))
        result = manager.perform
        expect(result.success?).to eq(true)
      end
    end
  end
end