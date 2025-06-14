# Discourse Rate Limit Posts

A Discourse plugin that implements daily post limits based on user trust levels to prevent spam and encourage quality posting.

## Features

- **Trust Level Based Limits**: Configure different daily post limits for each trust level (TL0-TL4)
- **Category Exemptions**: Allow unlimited posting in specific categories
- **Staff Bypass**: Administrators and moderators can post without limits
- **Warning Messages**: Official warning messages bypass all limits
- **Redis Tracking**: Efficient daily post counting with automatic expiration

## Configuration

Enable the plugin and configure limits in **Admin → Settings → Discourse Rate Limit Posts**:

| Setting | Default | Description |
|---------|---------|-------------|
| `discourse_ratelimit_posts_enabled` | false | Enable/disable the plugin |
| `discourse_ratelimit_posts_tl0_daily_limit` | 3 | Daily limit for Trust Level 0 users |
| `discourse_ratelimit_posts_tl1_daily_limit` | 10 | Daily limit for Trust Level 1 users |
| `discourse_ratelimit_posts_tl2_daily_limit` | 20 | Daily limit for Trust Level 2 users |
| `discourse_ratelimit_posts_tl3_daily_limit` | 50 | Daily limit for Trust Level 3 users |
| `discourse_ratelimit_posts_tl4_daily_limit` | 0 | Daily limit for Trust Level 4 users (0 = unlimited) |
| `discourse_ratelimit_posts_exempt_categories` | "" | Pipe-separated category IDs exempt from limits |

## Usage Examples

**Basic Setup:**
- TL0 users: 3 posts per day
- TL1 users: 10 posts per day
- Staff: Unlimited

**Category Exemptions:**
Set `discourse_ratelimit_posts_exempt_categories` to allow unlimited posting in selected categories.

**Unlimited Access:**
Set any trust level limit to `0` for unlimited posting.

