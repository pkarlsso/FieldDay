# Sport Preferences and Skill Levels Feature

## Overview
This feature allows users to select one or more sports on their profile and choose a skill level (1-5) for each sport. The preferences are persisted in the database and displayed on the user's profile.

## Implementation Details

### Backend

#### Data Model (`backend/src/models/User.js`)
- `sportSkills`: Array of objects containing:
  - `sport`: String (required, max 30 characters)
  - `skillLevel`: Number (required, min 1, max 5)
- Maintains backward compatibility with legacy `sports` array and `skillLevel` fields

#### GraphQL Schema (`backend/src/graphql/typeDefs.js`)
- `SportSkill` type: Defines the structure of sport skill objects
- `SportSkillInput` type: Input type for mutations
- `UpdateProfileInput`: Includes `sportSkills` field
- `User` type: Includes `sportSkills` field

#### GraphQL Resolvers (`backend/src/graphql/resolvers.js`)
- `cleanSportSkills()`: Validates sport skills input
  - Maximum 10 sports per user
  - No duplicate sports (case-insensitive)
  - Skill levels must be integers between 1-5
  - Sport names must be 1-30 characters
- `updateProfile` mutation: Handles updating sport skills
- `User.sportSkills` resolver: Provides backward compatibility for legacy accounts

### Frontend

#### Edit Profile Screen (`frontend/src/screens/EditProfileScreen.js`)
- Complete UI for managing sport preferences:
  - Add custom sports via text input
  - Quick-add from suggested sports (Pickleball, Tennis, Basketball, Soccer, Volleyball, Golf, Running)
  - Remove sports from profile
  - Set skill levels using clickable numbered dots (1-5)
  - Validation and error messages
  - Maximum 10 sports per user

#### Profile Screen (`frontend/src/screens/ProfileScreen.js`)
- Displays sport skills as pills showing:
  - Sport name
  - Skill level (formatted as "Level X")

### Validation Rules

1. **Skill Levels**: Must be integers between 1 and 5
   - 1 = Just starting out
   - 5 = Very experienced

2. **Sport Names**: 
   - Required
   - Maximum 30 characters
   - No duplicates (case-insensitive)

3. **Quantity**: Maximum 10 sports per user

4. **Persistence**: All changes are saved via GraphQL mutation and persist between sessions

### Testing

Comprehensive test suite in `scripts/test-sport-preferences.mjs`:
- User creation with sport skills
- GraphQL updateProfile mutation
- Skill level validation (1-5 range)
- Duplicate sport prevention
- Maximum sports limit (10)
- Query and retrieval of sport skills
- Backward compatibility with legacy format
- Sport name length validation
- Empty sport name validation
- Partial updates

### API Examples

#### Query User with Sport Skills
```graphql
query GetUser($id: ID!) {
  getUser(id: $id) {
    id
    name
    sportSkills {
      sport
      skillLevel
    }
  }
}
```

#### Update Profile with Sport Skills
```graphql
mutation UpdateProfile($input: UpdateProfileInput!) {
  updateProfile(input: $input) {
    id
    name
    sportSkills {
      sport
      skillLevel
    }
  }
}
```

Example input:
```json
{
  "input": {
    "name": "John Doe",
    "bio": "Sports enthusiast",
    "sportSkills": [
      { "sport": "Pickleball", "skillLevel": 4 },
      { "sport": "Tennis", "skillLevel": 3 }
    ]
  }
}
```

## User Flow

1. User navigates to their profile
2. Taps "Edit Profile"
3. Scrolls to "Sports and skill levels" section
4. Adds sports by:
   - Typing a sport name and tapping "Add"
   - Tapping a suggested sport pill
5. Sets skill level by tapping numbered dots (1-5)
6. Taps "Save Changes"
7. Preferences are saved and displayed on profile

## Backward Compatibility

The feature maintains compatibility with accounts created before per-sport skill levels:
- Legacy accounts with `sports` array and single `skillLevel` are automatically converted
- The resolver provides sportSkills derived from the legacy format
- New updates use the new sportSkills structure

## Benefits

- **Personalization**: Users can showcase their specific sports expertise
- **Matching**: Better matching for sports sessions based on skill levels
- **Flexibility**: Users can have different skill levels for different sports
- **User Experience**: Easy-to-use interface with quick-add suggestions