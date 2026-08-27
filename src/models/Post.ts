import { Op } from 'sequelize'
import { Table, Column, Model, Unique, DataType, PrimaryKey } from "sequelize-typescript"

const DAY_TO_MS = 1000 * 60 * 60 * 24

type PostData = {
  id: number
  created_at: string
}

@Table({ timestamps: false })
export class Post extends Model {
  @Unique
  @PrimaryKey
  @Column(DataType.INTEGER)
  declare id: number

  @Column(DataType.DATE)
  declare created_at: string

  @Column(DataType.DATE)
  declare last_read: number
}

/**
 * Find a post.
 * @param postId
 * @returns
 */
export async function checkPostExists(postId: number) {
  try {
    const post = await Post.findByPk(postId)
    if (post) {
      post.last_read = Date.now()
      post.save()
      return true
    }

    return false
  }
  catch (err) {
    return false
  }
}

/**
 * Add posts to db.
 * @param posts
 * @returns
 */
export async function addPosts(posts: PostData[]) {
  try {
    await Post.bulkCreate(posts, { ignoreDuplicates: true })
  }
  catch (err) {
    return null
  }
}

/**
 * Clear old posts
 */
export async function clearPosts() {
  try {
    const two_days_ago = Date.now() - (2 * DAY_TO_MS)
    const cleared = await Post.destroy({
      where: {
        [Op.and]: [
          {
            created_at: {
              [Op.lte]: two_days_ago
            },
          },
          {
            last_read: {
              [Op.or]: {
                [Op.lte]: two_days_ago,
                [Op.eq]: null
              }
            }
          }
        ]
      }
    })
    console.log(`[posts] cleared ${cleared} expired posts`)
  }
  catch (err) {
    return null
  }
}
