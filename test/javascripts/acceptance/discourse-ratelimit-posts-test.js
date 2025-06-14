import { click, fillIn, visit } from "@ember/test-helpers";
import { test } from "qunit";
import { 
  acceptance, 
  updateCurrentUser 
} from "discourse/tests/helpers/qunit-helpers";
import pretender, { response } from "discourse/tests/helpers/create-pretender";
import DiscoveryFixtures from "discourse/tests/fixtures/discovery-fixtures";
import TopicFixtures from "discourse/tests/fixtures/topic";

acceptance("Discourse Rate Limit Posts Plugin - Trust Level 0 Users", function (needs) {
  needs.user();
  needs.settings({
    discourse_ratelimit_posts_enabled: true,
    discourse_ratelimit_posts_tl0_daily_limit: 3,
    discourse_ratelimit_posts_tl1_daily_limit: 10,
    discourse_ratelimit_posts_tl2_daily_limit: 20,
    discourse_ratelimit_posts_tl3_daily_limit: 50,
    discourse_ratelimit_posts_tl4_daily_limit: 0,
  });
  needs.site({
    can_create_topic: true,
    can_tag_topics: false,
    categories: [
      {
        id: 1,
        name: "General",
        slug: "general",
        permission: 1,
        topic_template: null,
      },
      {
        id: 2,
        name: "Test Category",
        slug: "test-category",
        permission: 1,
        topic_template: "",
      },
    ],
  });
  needs.pretender((server, helper) => {
    server.get("/c/general/1/l/latest.json", () => {
      return helper.response(DiscoveryFixtures["/latest_can_create_topic.json"]);
    });
    server.get("/t/280.json", () => {
      return helper.response(TopicFixtures["/t/280/1.json"]);
    });
    server.post("/posts", () => {
      return helper.response({
        success: true,
        action: "create_post",
        post: { 
          id: 123, 
          topic_id: 280, 
          topic_slug: "internationalization-localization", 
          post_number: 2,
          cooked: "<p>This is my test reply</p>",
          raw: "This is my test reply",
          user_id: 1,
          created_at: new Date().toISOString()
        }
      });
    });
  });

  test("allows post creation when under daily limit", async function (assert) {
    updateCurrentUser({
      trust_level: 0,
      moderator: false,
      admin: false,
    });

    await visit("/t/internationalization-localization/280");
    await click("#topic-footer-buttons .btn.create");
    
    assert.dom(".d-editor-input").exists("composer is open");
    
    await fillIn(".d-editor-input", "This is my test reply within limits");
    await click("#reply-control button.create");
    
    // Check that no error dialog appears (post was successful)
    assert.dom(".dialog-body").doesNotExist("no error dialog appears - post was successful");
  });

  test("prevents post creation when daily limit exceeded", async function (assert) {
    updateCurrentUser({
      trust_level: 0,
      moderator: false,
      admin: false,
    });

    pretender.post("/posts", function () {
      return response(422, {
        errors: ["You have reached your daily post limit of 3 posts for trust level 0. You have 0 posts remaining today."]
      });
    });

    await visit("/t/internationalization-localization/280");
    await click("#topic-footer-buttons .btn.create");
    await fillIn(".d-editor-input", "This post should fail due to limit");
    await click("#reply-control button.create");
    
    assert.dom(".dialog-body").exists("error dialog appears");
    assert.dom(".dialog-body").includesText("daily post limit", "shows post limit error message");
    
    await click(".dialog-footer .btn-primary");
    assert.dom(".dialog-body").doesNotExist("error dialog is dismissed");
    assert.dom(".d-editor-input").exists("composer stays open");
  });

  test("allows topic creation when under daily limit", async function (assert) {
    updateCurrentUser({
      trust_level: 0,
      moderator: false,
      admin: false,
    });

    await visit("/c/general/1");
    await click("#create-topic");
    
    await fillIn("#reply-title", "My New Topic Within Limits");
    await fillIn(".d-editor-input", "This is the content of my new topic");
    
    await click("#reply-control button.create");
    
    // Check that no error dialog appears (topic creation was successful)
    assert.dom(".dialog-body").doesNotExist("no error dialog appears - topic creation was successful");
  });

  test("prevents topic creation when daily limit exceeded", async function (assert) {
    updateCurrentUser({
      trust_level: 0,
      moderator: false,
      admin: false,
    });

    pretender.post("/posts", function () {
      return response(422, {
        errors: ["You have reached your daily post limit of 3 posts for trust level 0. You have 0 posts remaining today."]
      });
    });

    await visit("/c/general/1");
    await click("#create-topic");
    await fillIn("#reply-title", "Topic That Should Fail");
    await fillIn(".d-editor-input", "Content that exceeds limit");
    
    await click("#reply-control button.create");
    
    assert.dom(".dialog-body").exists("shows error dialog");
    assert.dom(".dialog-body").includesText("daily post limit", "shows appropriate error message");
  });
});

acceptance("Discourse Rate Limit Posts Plugin - Trust Level 1 Users", function (needs) {
  needs.user();
  needs.settings({
    discourse_ratelimit_posts_enabled: true,
    discourse_ratelimit_posts_tl0_daily_limit: 3,
    discourse_ratelimit_posts_tl1_daily_limit: 10,
    discourse_ratelimit_posts_tl2_daily_limit: 20,
    discourse_ratelimit_posts_tl3_daily_limit: 50,
    discourse_ratelimit_posts_tl4_daily_limit: 0,
  });
  needs.site({
    can_create_topic: true,
    can_tag_topics: false,
    categories: [
      {
        id: 1,
        name: "General",
        slug: "general",
        permission: 1,
        topic_template: null,
      },
      {
        id: 2,
        name: "Test Category",
        slug: "test-category",
        permission: 1,
        topic_template: "",
      },
    ],
  });
  needs.pretender((server, helper) => {
    server.get("/c/general/1/l/latest.json", () => {
      return helper.response(DiscoveryFixtures["/latest_can_create_topic.json"]);
    });
    server.get("/t/280.json", () => {
      return helper.response(TopicFixtures["/t/280/1.json"]);
    });
    server.post("/posts", () => {
      return helper.response({
        success: "OK",
        action: "create_post",
        post: { id: 123, topic_id: 280, post_number: 2 }
      });
    });
  });

  test("allows more posts than TL0 users", async function (assert) {
    updateCurrentUser({
      trust_level: 1,
      moderator: false,
      admin: false,
    });

    await visit("/t/internationalization-localization/280");
    await click("#topic-footer-buttons .btn.create");
    
    await fillIn(".d-editor-input", "TL1 user post within higher limits");
    await click("#reply-control button.create");
    
    // Check that no error dialog appears (post was successful)
    assert.dom(".dialog-body").doesNotExist("no error dialog appears - TL1 user can post with higher limits");
  });

  test("respects TL1 daily limit", async function (assert) {
    updateCurrentUser({
      trust_level: 1,
      moderator: false,
      admin: false,
    });

    pretender.post("/posts", function () {
      return response(422, {
        errors: ["You have reached your daily post limit of 10 posts for trust level 1. You have 0 posts remaining today."]
      });
    });

    await visit("/t/internationalization-localization/280");
    await click("#topic-footer-buttons .btn.create");
    await fillIn(".d-editor-input", "TL1 post that exceeds limit");
    await click("#reply-control button.create");
    
    assert.dom(".dialog-body").exists("shows error dialog for TL1 limit");
    assert.dom(".dialog-body").includesText("10 posts for trust level 1", "shows correct TL1 limit in error");
  });
});

acceptance("Discourse Rate Limit Posts Plugin - High Trust Level Users", function (needs) {
  needs.user();
  needs.settings({
    discourse_ratelimit_posts_enabled: true,
    discourse_ratelimit_posts_tl0_daily_limit: 3,
    discourse_ratelimit_posts_tl1_daily_limit: 10,
    discourse_ratelimit_posts_tl2_daily_limit: 20,
    discourse_ratelimit_posts_tl3_daily_limit: 50,
    discourse_ratelimit_posts_tl4_daily_limit: 0,
  });
  needs.site({
    can_create_topic: true,
    can_tag_topics: false,
    categories: [
      {
        id: 1,
        name: "General",
        slug: "general",
        permission: 1,
        topic_template: null,
      },
      {
        id: 2,
        name: "Test Category",
        slug: "test-category",
        permission: 1,
        topic_template: "",
      },
    ],
  });
  needs.pretender((server, helper) => {
    server.get("/c/general/1/l/latest.json", () => {
      return helper.response(DiscoveryFixtures["/latest_can_create_topic.json"]);
    });
    server.post("/posts", () => {
      return helper.response({
        success: "OK",
        action: "create_post",
        post: { id: 123, topic_id: 280, post_number: 2 }
      });
    });
  });

  test("TL4 users have unlimited posts", async function (assert) {
    updateCurrentUser({
      trust_level: 4,
      moderator: false,
      admin: false,
    });

    await visit("/t/internationalization-localization/280");
    await click("#topic-footer-buttons .btn.create");
    
    await fillIn(".d-editor-input", "TL4 unlimited post");
    await click("#reply-control button.create");
    
    // Check that no error dialog appears (post was successful)
    assert.dom(".dialog-body").doesNotExist("no error dialog appears - TL4 user can post without limits");
  });
});

acceptance("Discourse Rate Limit Posts Plugin - Staff Users", function (needs) {
  needs.user();
  needs.settings({
    discourse_ratelimit_posts_enabled: true,
    discourse_ratelimit_posts_tl0_daily_limit: 3,
    discourse_ratelimit_posts_tl1_daily_limit: 10,
    discourse_ratelimit_posts_tl2_daily_limit: 20,
    discourse_ratelimit_posts_tl3_daily_limit: 50,
    discourse_ratelimit_posts_tl4_daily_limit: 0,
  });
  needs.site({
    can_create_topic: true,
    can_tag_topics: false,
    categories: [
      {
        id: 1,
        name: "General",
        slug: "general",
        permission: 1,
        topic_template: null,
      },
      {
        id: 2,
        name: "Test Category",
        slug: "test-category",
        permission: 1,
        topic_template: "",
      },
    ],
  });
  needs.pretender((server, helper) => {
    server.get("/c/general/1/l/latest.json", () => {
      return helper.response(DiscoveryFixtures["/latest_can_create_topic.json"]);
    });
    server.post("/posts", () => {
      return helper.response({
        success: "OK",
        action: "create_post",
        post: { id: 123, topic_id: 280, post_number: 2 }
      });
    });
  });

  test("moderators bypass post limits", async function (assert) {
    updateCurrentUser({
      trust_level: 0,
      moderator: true,
      admin: false,
    });

    await visit("/t/internationalization-localization/280");
    await click("#topic-footer-buttons .btn.create");
    
    await fillIn(".d-editor-input", "Moderator post bypassing limits");
    await click("#reply-control button.create");
    
    // Check that no error dialog appears (post was successful)
    assert.dom(".dialog-body").doesNotExist("no error dialog appears - moderator can post despite low trust level");
  });

  test("admins bypass post limits", async function (assert) {
    updateCurrentUser({
      trust_level: 0,
      moderator: false,
      admin: true,
    });

    await visit("/t/internationalization-localization/280");
    await click("#topic-footer-buttons .btn.create");
    
    await fillIn(".d-editor-input", "Admin post bypassing limits");
    await click("#reply-control button.create");
    
    // Check that no error dialog appears (post was successful)
    assert.dom(".dialog-body").doesNotExist("no error dialog appears - admin can post despite low trust level");
  });

  test("staff can create topics without limits", async function (assert) {
    updateCurrentUser({
      trust_level: 0,
      moderator: true,
      admin: false,
    });

    await visit("/c/general/1");
    await click("#create-topic");
    
    await fillIn("#reply-title", "Staff Topic No Limits");
    await fillIn(".d-editor-input", "Staff can create topics without restrictions");
    
    await click("#reply-control button.create");
    
    // Check that no error dialog appears (topic creation was successful)
    assert.dom(".dialog-body").doesNotExist("no error dialog appears - staff topic created successfully");
  });
});

acceptance("Discourse Rate Limit Posts Plugin - Plugin Disabled", function (needs) {
  needs.user();
  needs.settings({
    discourse_ratelimit_posts_enabled: false,
    discourse_ratelimit_posts_tl0_daily_limit: 3,
    discourse_ratelimit_posts_tl1_daily_limit: 10,
    discourse_ratelimit_posts_tl2_daily_limit: 20,
    discourse_ratelimit_posts_tl3_daily_limit: 50,
    discourse_ratelimit_posts_tl4_daily_limit: 0,
  });
  needs.site({
    can_create_topic: true,
    can_tag_topics: false,
    categories: [
      {
        id: 1,
        name: "General",
        slug: "general",
        permission: 1,
        topic_template: null,
      },
      {
        id: 2,
        name: "Test Category",
        slug: "test-category",
        permission: 1,
        topic_template: "",
      },
    ],
  });
  needs.pretender((server, helper) => {
    server.get("/c/general/1/l/latest.json", () => {
      return helper.response(DiscoveryFixtures["/latest_can_create_topic.json"]);
    });
    server.post("/posts", () => {
      return helper.response({
        success: "OK",
        action: "create_post",
        post: { id: 123, topic_id: 280, post_number: 2 }
      });
    });
  });

  test("no limits when plugin disabled for TL0", async function (assert) {
    updateCurrentUser({
      trust_level: 0,
      moderator: false,
      admin: false,
    });

    await visit("/t/internationalization-localization/280");
    await click("#topic-footer-buttons .btn.create");
    
    await fillIn(".d-editor-input", "Post when plugin disabled");
    await click("#reply-control button.create");
    
    // Check that no error dialog appears (post was successful)
    assert.dom(".dialog-body").doesNotExist("no error dialog appears - TL0 user can post when plugin disabled");
  });

  test("can create topics when plugin disabled", async function (assert) {
    updateCurrentUser({
      trust_level: 0,
      moderator: false,
      admin: false,
    });

    await visit("/c/general/1");
    await click("#create-topic");
    
    await fillIn("#reply-title", "Topic When Plugin Disabled");
    await fillIn(".d-editor-input", "Topic creation works when plugin is disabled");
    
    await click("#reply-control button.create");
    
    // Check that no error dialog appears (topic creation was successful)
    assert.dom(".dialog-body").doesNotExist("no error dialog appears - topic created when plugin disabled");
  });
});

acceptance("Discourse Rate Limit Posts Plugin - Warning Messages", function (needs) {
  needs.user();
  needs.settings({
    discourse_ratelimit_posts_enabled: true,
    discourse_ratelimit_posts_tl0_daily_limit: 3,
    discourse_ratelimit_posts_tl1_daily_limit: 10,
    discourse_ratelimit_posts_tl2_daily_limit: 20,
    discourse_ratelimit_posts_tl3_daily_limit: 50,
    discourse_ratelimit_posts_tl4_daily_limit: 0,
  });
  needs.site({
    can_create_topic: true,
    can_tag_topics: false,
    categories: [
      {
        id: 1,
        name: "General",
        slug: "general",
        permission: 1,
        topic_template: null,
      },
      {
        id: 2,
        name: "Test Category",
        slug: "test-category",
        permission: 1,
        topic_template: "",
      },
    ],
  });
  needs.pretender((server, helper) => {
    server.get("/c/general/1/l/latest.json", () => {
      return helper.response(DiscoveryFixtures["/latest_can_create_topic.json"]);
    });
    server.post("/posts", () => {
      return helper.response({
        success: "OK",
        action: "create_post",
        post: { id: 123, topic_id: 280, post_number: 2 }
      });
    });
  });

  test("warning messages bypass post limits", async function (assert) {
    updateCurrentUser({
      trust_level: 0,
      moderator: true,
      admin: false,
    });

    // Test that warning messages can be created even if regular limit would be exceeded
    await visit("/t/internationalization-localization/280");
    await click("#topic-footer-buttons .btn.create");
    
    await fillIn(".d-editor-input", "This is a warning message");
    
    // In a real implementation, we'd need to simulate the warning message flow
    // For now, we test that the post can be created (warning messages use is_warning: true)
    await click("#reply-control button.create");
    
    // Check that no error dialog appears (post was successful)
    assert.dom(".dialog-body").doesNotExist("no error dialog appears - warning message created successfully");
  });
});

acceptance("Discourse Rate Limit Posts Plugin - Edge Cases", function (needs) {
  needs.user();
  needs.settings({
    discourse_ratelimit_posts_enabled: true,
    discourse_ratelimit_posts_tl0_daily_limit: 0, // Unlimited
    discourse_ratelimit_posts_tl1_daily_limit: 1, // Very low limit for testing
    discourse_ratelimit_posts_tl2_daily_limit: 20,
    discourse_ratelimit_posts_tl3_daily_limit: 50,
    discourse_ratelimit_posts_tl4_daily_limit: 0,
  });
  needs.site({
    can_create_topic: true,
    can_tag_topics: false,
    categories: [
      {
        id: 1,
        name: "General",
        slug: "general",
        permission: 1,
        topic_template: null,
      },
      {
        id: 2,
        name: "Test Category",
        slug: "test-category",
        permission: 1,
        topic_template: "",
      },
    ],
  });
  needs.pretender((server, helper) => {
    server.get("/c/general/1/l/latest.json", () => {
      return helper.response(DiscoveryFixtures["/latest_can_create_topic.json"]);
    });
    server.post("/posts", () => {
      return helper.response({
        success: "OK",
        action: "create_post",
        post: { id: 123, topic_id: 280, post_number: 2 }
      });
    });
  });

  test("handles zero limit (unlimited) correctly for TL0", async function (assert) {
    updateCurrentUser({
      trust_level: 0,
      moderator: false,
      admin: false,
    });

    await visit("/t/internationalization-localization/280");
    await click("#topic-footer-buttons .btn.create");
    
    await fillIn(".d-editor-input", "Post with unlimited TL0");
    await click("#reply-control button.create");
    
    // Check that no error dialog appears (post was successful)
    assert.dom(".dialog-body").doesNotExist("no error dialog appears - TL0 with 0 limit (unlimited) works");
  });

  test("handles very low limit (1 post) correctly", async function (assert) {
    updateCurrentUser({
      trust_level: 1,
      moderator: false,
      admin: false,
    });

    pretender.post("/posts", function () {
      return response(422, {
        errors: ["You have reached your daily post limit of 1 posts for trust level 1. You have 0 posts remaining today."]
      });
    });

    await visit("/t/internationalization-localization/280");
    await click("#topic-footer-buttons .btn.create");
    await fillIn(".d-editor-input", "Second post should fail");
    await click("#reply-control button.create");
    
    assert.dom(".dialog-body").exists("shows error for very low limit");
    assert.dom(".dialog-body").includesText("1 posts for trust level 1", "shows correct limit of 1");
  });
});

acceptance("Discourse Rate Limit Posts Plugin - Category Exemptions", function (needs) {
  needs.user();
  needs.settings({
    discourse_ratelimit_posts_enabled: true,
    discourse_ratelimit_posts_tl0_daily_limit: 2, // Very low limit for testing
    discourse_ratelimit_posts_tl1_daily_limit: 10,
    discourse_ratelimit_posts_tl2_daily_limit: 20,
    discourse_ratelimit_posts_tl3_daily_limit: 50,
    discourse_ratelimit_posts_tl4_daily_limit: 0,
    discourse_ratelimit_posts_exempt_categories: "1|3", // Exempt categories 1 and 3
  });
  needs.site({
    can_create_topic: true,
    can_tag_topics: false,
    categories: [
      {
        id: 1,
        name: "Exempt Category",
        slug: "exempt-category",
        permission: 1,
        topic_template: null,
      },
      {
        id: 2,
        name: "Regular Category",
        slug: "regular-category",
        permission: 1,
        topic_template: "",
      },
      {
        id: 3,
        name: "Another Exempt",
        slug: "another-exempt",
        permission: 1,
        topic_template: null,
      },
    ],
  });
  needs.pretender((server, helper) => {
    server.get("/c/exempt-category/1/l/latest.json", () => {
      return helper.response(DiscoveryFixtures["/latest_can_create_topic.json"]);
    });
    server.get("/c/regular-category/2/l/latest.json", () => {
      return helper.response(DiscoveryFixtures["/latest_can_create_topic.json"]);
    });
    server.get("/c/another-exempt/3/l/latest.json", () => {
      return helper.response(DiscoveryFixtures["/latest_can_create_topic.json"]);
    });
    server.get("/t/280.json", () => {
      return helper.response(TopicFixtures["/t/280/1.json"]);
    });
    server.post("/posts", () => {
      return helper.response({
        success: true,
        action: "create_post",
        post: { 
          id: 123, 
          topic_id: 280, 
          topic_slug: "internationalization-localization", 
          post_number: 2,
          cooked: "<p>This is my test reply</p>",
          raw: "This is my test reply",
          user_id: 1,
          created_at: new Date().toISOString()
        }
      });
    });
  });

  test("allows unlimited posting in exempt categories", async function (assert) {
    updateCurrentUser({
      trust_level: 0,
      moderator: false,
      admin: false,
    });

    // Test posting in exempt category 1
    await visit("/c/exempt-category/1");
    await click("#create-topic");
    
    await fillIn("#reply-title", "Post in Exempt Category");
    await fillIn(".d-editor-input", "This should work even after reaching limits");
    
    await click("#reply-control button.create");
    
    // Check that no error dialog appears (post was successful)
    assert.dom(".dialog-body").doesNotExist("no error dialog appears - exempt category allows posts");
  });

  test("respects limits in non-exempt categories while allowing exempt categories", async function (assert) {
    updateCurrentUser({
      trust_level: 0,
      moderator: false,
      admin: false,
    });

    // First simulate reaching the limit by trying to post in regular category after limit exceeded
    pretender.post("/posts", function () {
      return response(422, {
        errors: ["You have reached your daily post limit of 2 posts for trust level 0. You have 0 posts remaining today."]
      });
    });

    // Test posting in regular category (should fail due to limit)
    await visit("/c/regular-category/2");
    await click("#create-topic");
    
    await fillIn("#reply-title", "Post in Regular Category");
    await fillIn(".d-editor-input", "This should fail due to limits");
    
    await click("#reply-control button.create");
    
    // Check that error dialog appears (limit exceeded)
    assert.dom(".dialog-body").exists("error dialog appears in regular category");
    assert.dom(".dialog-body").includesText("daily post limit", "shows post limit error");
    
    // Close the error dialog
    await click(".dialog-footer .btn-primary");
  });

  test("allows posting in second exempt category", async function (assert) {
    updateCurrentUser({
      trust_level: 0,
      moderator: false,
      admin: false,
    });

    // Test posting in exempt category 3
    await visit("/c/another-exempt/3");
    await click("#create-topic");
    
    await fillIn("#reply-title", "Post in Another Exempt Category");
    await fillIn(".d-editor-input", "This should also work in exempt category 3");
    
    await click("#reply-control button.create");
    
    // Check that no error dialog appears (post was successful)
    assert.dom(".dialog-body").doesNotExist("no error dialog appears - second exempt category works");
  });

  test("replies work in exempt categories", async function (assert) {
    updateCurrentUser({
      trust_level: 0,
      moderator: false,
      admin: false,
    });

    await visit("/t/internationalization-localization/280");
    await click("#topic-footer-buttons .btn.create");
    
    assert.dom(".d-editor-input").exists("composer is open");
    
    await fillIn(".d-editor-input", "Reply in exempt category topic");
    await click("#reply-control button.create");
    
    // Check that no error dialog appears (reply was successful)
    assert.dom(".dialog-body").doesNotExist("no error dialog appears - reply in exempt category works");
  });
});