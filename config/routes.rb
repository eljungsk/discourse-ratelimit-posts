# frozen_string_literal: true

DiscourseRateLimitPosts::Engine.routes.draw do
  # define routes here
end

Discourse::Application.routes.draw { mount ::DiscourseRateLimitPosts::Engine, at: "discourse-ratelimit-posts" }
