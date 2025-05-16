import React, { useEffect, useState } from "react";
import { renderPostBody } from "@ecency/render-helper";
import {getUersContent} from "../../utils/hiveUtils"
import "./BlogContent.scss"


const BlogContent = ({ author, permlink}) => {
  const [content, setContent] = useState("");
  const [renderedContent, setRenderedContent] = useState("");

  
  // const author = "dootilda"
  // const permlink = 'vrcqokytxb'

  // Fetch post content from the Hive blockchain
  async function getPostDescription(author, permlink) {
    const data = await getUersContent(author, permlink)
    // console.log(data)
    return data.body
  }

  // Fetch content when author or permlink change
  useEffect(() => {
    async function fetchContent() {
      const postContent = await getPostDescription(author, permlink);
      // console.error("postContent===>:", postContent);
      if (postContent) {
        setContent(postContent);
      } else {
        setContent("No content available");
      }
    }

    fetchContent();
  }, [author, permlink]);

  console.log(content)

  // Render content when it changes
  useEffect(() => {

    if (content) {
      // Convert content to a proper string
      const contentString =
        typeof content === "string"
          ? content
          : Array.isArray(content)
          ? content.join("\n")
          : "";

          // console.error("contentString", contentString);

      try {
        // Render the content using @ecency/render-heper
        const renderedHTML = renderPostBody(contentString, false);
        // console.log("Rendered HTML Output:", renderedHTML);
        setRenderedContent(renderedHTML);
      } catch (error) {
        console.error("Error rendering post body:", error);
        setRenderedContent("Error processing content.");
      }
    }
  }, [content]);

  // Render the processed content
  return (
    <div
      className="markdown-view"
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
};

export default BlogContent;