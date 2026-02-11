import { gql } from "@apollo/client";

export const USER_DETAILS = gql`
  query MyQuery2($id: String) {
    profile(id: $id) {
      ... on HiveProfile {
        id
        name
        images {
          avatar
          cover
        }
        about
        username
        did
      }
      ... on CeramicProfile {
        id
        name
        images {
          avatar
          cover
        }
        did
      }
    }
  }
`;

export const GET_VIDEO = gql`
  query VideoInfo($permlink: String, $author: String) {
    socialPost(author: $author, permlink: $permlink) {
      ... on HivePost {
        spkvideo
      }
    }
  }
`;
export const GET_VIDEO_DETAILS = gql`
  query VideoDetails($permlink: String, $author: String) {
    socialPost(author: $author, permlink: $permlink) {
      ... on HivePost {
        author {
          id
          profile {
            ... on HiveProfile {
              id
              name
              images {
                avatar
              }
            }
          }
        }
        body
        stats {
          num_comments
          num_votes
          total_hive_reward
        }
        community
        created_at
        tags
        title
        parent_permlink
      }
    }
  }
`;





//TODO: why its not working when removing the repeated code
// export const GET_COMMENTS = gql`
//   query CommentsInfo($permlink: String = "", $author: String = "") {
//     socialPost(author: $author, permlink: $permlink) {
//       ... on HivePost {
//         children {
//           stats {
//            num_comments
//           }
//           author {
//             username
//             profile {
//               ... on HiveProfile {
//                 name
//                 images {
//                   avatar
//                 }
//               }
//             }
//           }
//           body
//           permlink
//           created_at
//         }
//       }
//     }
//   }
// `;

export const GET_COMMENTS = gql`
  query CommentsInfo($permlink: String = "", $author: String = "") {
    socialPost(author: $author, permlink: $permlink) {
      ... on HivePost {
        children {
          stats {
            num_comments
          }
          author {
            username
            profile {
              ... on HiveProfile {
                name
                images {
                  avatar
                }
              }
            }
          }
          body
          permlink
          created_at
          children {
            stats {
              num_comments
              num_votes
              total_hive_reward
            }
            author {
              username
              profile {
                ... on HiveProfile {
                  name
                  images {
                    avatar
                  }
                }
              }
            }
            body
            permlink
            created_at
            children {
              stats {
                num_comments
                num_votes
                total_hive_reward
              }
              author {
                username
                profile {
                  ... on HiveProfile {
                    name
                    images {
                      avatar
                    }
                  }
                }
              }
              body
              permlink
              created_at
              children {
                stats {
                  num_comments
                  num_votes
                  total_hive_reward
                }
                author {
                  username
                  profile {
                    ... on HiveProfile {
                      name
                      images {
                        avatar
                      }
                    }
                  }
                }
                body
                permlink
                created_at
                children {
                  stats {
                    num_comments
                    num_votes
                    total_hive_reward
                  }
                  author {
                    username
                    profile {
                      ... on HiveProfile {
                        name
                        images {
                          avatar
                        }
                      }
                    }
                  }
                  body
                  permlink
                  created_at
                  children {
                    stats {
                      num_comments
                      num_votes
                      total_hive_reward
                    }
                    author {
                      username
                      profile {
                        ... on HiveProfile {
                          name
                          images {
                            avatar
                          }
                        }
                      }
                    }
                    body
                    permlink
                    created_at
                    children {
                      stats {
                        num_comments
                        num_votes
                        total_hive_reward
                      }
                      author {
                        username
                        profile {
                          ... on HiveProfile {
                            name
                            images {
                              avatar
                            }
                          }
                        }
                      }
                      body
                      permlink
                      created_at
                      children {
                        stats {
                          num_comments
                        }
                        author {
                          username
                          profile {
                            ... on HiveProfile {
                              name
                              images {
                                avatar
                              }
                            }
                          }
                        }
                        body
                        permlink
                        created_at
                        children {
                          stats {
                            num_comments
                            num_votes
                            total_hive_reward
                          }
                          author {
                            username
                            profile {
                              ... on HiveProfile {
                                name
                                images {
                                  avatar
                                }
                              }
                            }
                          }
                          body
                          permlink
                          created_at
                          children {
                            stats {
                              num_comments
                              num_votes
                              total_hive_reward
                            }
                            author {
                              username
                              profile {
                                ... on HiveProfile {
                                  name
                                  images {
                                    avatar
                                  }
                                }
                              }
                            }
                            body
                            permlink
                            created_at
                            children {
                              stats {
                                num_comments
                                num_votes
                                total_hive_reward
                              }
                              author {
                                username
                                profile {
                                  ... on HiveProfile {
                                    name
                                    images {
                                      avatar
                                    }
                                  }
                                }
                              }
                              body
                              permlink
                              created_at
                              children {
                                stats {
                                  num_comments
                                  num_votes
                                  total_hive_reward
                                }
                                author {
                                  username
                                  profile {
                                    ... on HiveProfile {
                                      name
                                      images {
                                        avatar
                                      }
                                    }
                                  }
                                }
                                body
                                permlink
                                created_at
                                children {
                                  stats {
                                    num_comments
                                    num_votes
                                    total_hive_reward
                                  }
                                  author {
                                    username
                                    profile {
                                      ... on HiveProfile {
                                        name
                                        images {
                                          avatar
                                        }
                                      }
                                    }
                                  }
                                  body
                                  permlink
                                  created_at
                                  children {
                                    stats {
                                      num_comments
                                      num_votes
                                      total_hive_reward
                                    }
                                    author {
                                      username
                                      profile {
                                        ... on HiveProfile {
                                          name
                                          images {
                                            avatar
                                          }
                                        }
                                      }
                                    }
                                    body
                                    permlink
                                    created_at
                                    children {
                                      stats {
                                        num_comments
                                        num_votes
                                        total_hive_reward
                                      }
                                      author {
                                        username
                                        profile {
                                          ... on HiveProfile {
                                            name
                                            images {
                                              avatar
                                            }
                                          }
                                        }
                                      }
                                      body
                                      permlink
                                      created_at
                                      children {
                                        stats {
                                          num_comments
                                          num_votes
                                          total_hive_reward
                                        }
                                        author {
                                          username
                                          profile {
                                            ... on HiveProfile {
                                              name
                                              images {
                                                avatar
                                              }
                                            }
                                          }
                                        }
                                        body
                                        permlink
                                        created_at
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_LEADER_BOARD = gql`
  query MyQuery {
    leaderBoard {
      items {
        author
        author_profile {
          ... on CeramicProfile {
            id
            name
          }
        }
        rank
        score
      }
      total_active_creators
    }
  }
`;

export const GET_RELATED_FEED = gql`
  query MyQuery {
    relatedFeed {
      items {
        body
        children {
          body
          children {
            body
            children {
              body
              title
            }
          }
        }
        created_at
      }
    }
  }
`;
export const GET_SOCIAL_FEED_BY_CREATOR = gql`
  query ProfileVideoData($id: String) {
    socialFeed(feedOptions: { byCreator: { _eq: $id } }) {
      items {
        ... on HivePost {
          spkvideo
          body
          title
          stats {
            num_comments
            num_votes
            total_hive_reward
          }
          created_at
          refs
          author {
            username
          }
          permlink
        }
        permlink
      }
    }
  }
`;

// Query for author's videos only (with spkvideo filter)
export const GET_AUTHOR_VIDEOS = gql`
  query AuthorVideos($id: String) {
    socialFeed(feedOptions: { byCreator: { _eq: $id } }, spkvideo: { only: true }) {
      items {
        ... on HivePost {
          spkvideo
          body
          title
          stats {
            num_comments
            num_votes
            total_hive_reward
          }
          created_at
          author {
            username
          }
          permlink
        }
        permlink
      }
    }
  }
`;

export const GET_SOCIAL_FEED = gql`
  query MyQuery {
    socialFeed(
      apps: {
        _eq: ""
        _gt: 10
        _gte: 10
        _in: ""
        _lt: 10
        _lte: 10
        _ne: ""
        _nin: ""
        _regex: ""
      }
    ) {
      items {
        body
        children {
          body
        }
        ... on HivePost {
          parent_author
          parent_permlink
          body
          children {
            body
            children {
              body
            }
          }
          community
        }
      }
    }
  }
`;

export const GET_TOTAL_COUNT_OF_FOLLOWING = gql`
  query GETTOTALCOUNTOFFOLLOWING($id: String) {
    follows(id: $id) {
      followings {
        followed_at
        follower
        following
      }
      followings_count
      followers_count
    }
  }
`;

export const GET_TRENDING_TAGS = gql`
  query TrendingTagFeed($tag: String) {
    trendingFeed(
      spkvideo: { only: true, firstUpload: true }

      feedOptions: { byTag: { _eq: $tag } }

      pagination: { limit: 50, skip: 0 }
    ) {
      items {
        created_at
        title
        ... on HivePost {
          permlink
          lang
          title
          tags
          spkvideo
          stats {
            num_comments
            num_votes
            total_hive_reward
          }
          author {
            username
          }
          json_metadata {
            raw
          }
        }
      }
    }
  }
`;

export const GET_TRENDING_FEED = gql`
  query MyQuery {
    trendingFeed(spkvideo: { only: true }) {
      items {
        ... on HivePost {
          permlink
          spkvideo
          author {
            id
            profile {
              ... on HiveProfile {
                id
                name
                images {
                  avatar
                }
              }
            }
            username
          }
          body
          title
          stats {
            num_comments
            num_votes
            total_hive_reward
          }
          tags
          lang
          hive_rewards
          created_at
          community
        }
      }
    }
  }
`;

export const GET_SYNC_STATE = gql`
  query MyQuery {
    syncState {
      blockLag
      latestBlockLagDiff
      syncEtaSeconds
    }
  }
`;

export const GET_SOCIAL_POST = gql`
  query MyQuery($author: String, $permlink: String) {
    socialPost(author: $author, permlink: $permlink) {
      ... on HivePost {
        parent_author
        parent_permlink
        author {
          id
          profile {
            ... on HiveProfile {
              id
              name
              images {
                avatar
              }
            }
          }
          username
        }
        json_metadata {
          raw
        }
        stats {
          num_comments
          num_votes
          total_hive_reward
        }
        app_metadata
        spkvideo
        refs
        post_type
        permlink
        title
        tags
        updated_at
        body
        children {
          body
          children
        }
        community
        created_at
      }
    }
  }
`;

// export const GET_COMMENTS = gql``;

export const GET_PROFILE = gql`
  query MyQuery($id: String) {
    profile(id: $id) {
      ... on CeramicProfile {
        id
        name
      }
      ... on HiveProfile {
        id
        name
        about
        did
        images {
          avatar
          cover
        }
        src
        username
        website
        location
        json_metadata
      }
    }
  }
`;

// export const GET_COMMUNITIES = gql`
//   query MyQuery($id: String) {
//     community(id: $id) {
//       about
//       created_at
//       is_nsfw
//       lang
//       subscribers
//       title
//       trendingFeed {
//         items {
//           author {
//             id
//           }
//           ... on HivePost {
//             parent_author
//             parent_permlink
//             community
//             title
//             author {
//               username
//               id
//             }
//             spkvideo
//           }
//         }
//       }
//       latestFeed {
//         items {
//           author {
//             id
//           }
//           ... on HivePost {
//             parent_author
//             parent_permlink
//             author {
//               id
//               username
//             }
//             community
//             spkvideo
//             title
//           }
//         }
//       }
//     }
//   }
// `;

export const GET_COMMUNITIES = gql`
  query MyQuery($id: String) {
    community(id: $id) {
      about
      created_at
      is_nsfw
      lang
      subscribers
      title
      trendingFeed {
        items {
          author {
            id
          }
          ... on HivePost {
            parent_author
            parent_permlink
            community
            title
            author {
              username
              id
            }
            spkvideo
            stats {
              num_comments
              num_votes
              total_hive_reward
            }
            created_at # Add created_at here
          }
        }
      }
      latestFeed {
        items {
          author {
            id
          }
          ... on HivePost {
            parent_author
            parent_permlink
            author {
              id
              username
            }
            community
            spkvideo
            title
            stats {
              num_comments
              num_votes
              total_hive_reward
            }
            created_at # Add created_at here
            permlink # Add permlink here
          }
        }
      }
    }
  }
`;
export const GET_FOLLOWS = gql`
  query MyQuery {
    follows(id: "") {
      followers_count
      followings_count
      followers {
        followed_at
        follower
        follower_profile {
          ... on CeramicProfile {
            id
            name
          }
        }
        following
        following_profile {
          ... on CeramicProfile {
            id
            name
          }
        }
      }
      followings {
        followed_at
        follower
        follower_profile {
          ... on CeramicProfile {
            id
            name
          }
        }
        following
        following_profile {
          ... on CeramicProfile {
            id
            name
          }
        }
      }
    }
  }
`;

export const LATEST_FEED = gql`
  query LatestFeed {
    feed: socialFeed {
      items {
        body
        created_at
        parent_author
        parent_permlink
        permlink
        title
        updated_at
        ... on HivePost {
          parent_author
          parent_permlink
          author {
            username
          }
          json_metadata {
            raw
          }
          stats {
            num_comments
            num_votes
            total_hive_reward
          }
          app_metadata
          spkvideo
          refs
          post_type
          permlink
          title
          tags
          updated_at
          body
          community
          created_at
        }
      }
    }
  }
`;

export const TRENDING_FEED = gql`
  query TrendingFeed {
    trendingFeed(
      spkvideo: { only: true }
      feedOptions: {}
      pagination: { limit: 50, skip: 0 }
    ) {
      items {
        created_at
        title
        ... on HivePost {
          parent_author
          parent_permlink
          lang
          spkvideo
          stats {
            num_comments
            num_votes
            total_hive_reward
          }
          author {
            id
            username
          }
          community
          json_metadata {
            app
            image
            raw
          }
          tags
          title
          permlink
          post_type
          refs
          body
        }
        permlink
        parent_permlink
        parent_author
        body
      }
    }
  }
`;

export const GET_RELATED = gql`
  query MyQuery($author: String, $permlink: String) {
    relatedFeed(
      author: $author
      permlink: $permlink
      spkvideo: { only: true }
    ) {
      items {
        ... on HivePost {
          permlink
          spkvideo
          author {
            id
            profile {
              ... on HiveProfile {
                id
                name
                images {
                  avatar
                }
              }
            }
            username
          }
          body
          title
          stats {
            num_comments
            num_votes
            total_hive_reward
          }
          tags
          lang
          hive_rewards
          created_at
          community
        }
      }
    }
  }
`;

export const FIRST_UPLOAD_FEED = gql`
  query MyQuery {
    trendingFeed(spkvideo: { only: true, firstUpload: true }) {
      items {
        ... on HivePost {
          permlink
          spkvideo
          author {
            username
          }
          body
          title
          stats {
            num_comments
            num_votes
            total_hive_reward
          }
          tags
          lang
          hive_rewards
          created_at
          community
        }
      }
    }
  }
`;

export const NEW_CONTENT = gql`
  query NewContent($limit: Int = 50, $skip: Int = 0) {
    socialFeed(spkvideo: { only: true, firstUpload: true }, pagination: { limit: $limit, skip: $skip }) {
      items {
        ... on HivePost {
          permlink
          spkvideo
          author {
            id
            profile {
              ... on HiveProfile {
                id
                name
                images {
                  avatar
                }
              }
            }
            username
          }
          body
          title
          stats {
            num_comments
            num_votes
            total_hive_reward
          }
          tags
          lang
          hive_rewards
          created_at
          community
        }
      }
    }
  }
`;

// export const GET_COMMENTS = gql`
//   query CommentsInfo($permlink: String = "", $author: String = "") {
//     socialPost(author: $author, permlink: $permlink) {
//       ... on HivePost {
//         children {
//           ...CommentFields
//         }
//       }
//     }
//   }

//   fragment CommentFields on HivePost {
//     stats {
//       num_comments
//     }
//     author {
//       username
//       profile {
//         ... on HiveProfile {
//           name
//           images {
//             avatar
//           }
//         }
//       }
//     }
//     body
//     permlink
//     created_at
//     children {
//       ...CommentFields
//     }
//   }
// `;
