# DeepSeek App 的预设提示词（官方原文）

> 来源：`deepseek-ai/DeepSeek-R1` 仓库 README 的「Official Prompts」一节。
> 抓取时间：2026-11-18。原文英文，下面是逐字翻译与原文并列。
> 仓库地址：https://github.com/deepseek-ai/DeepSeek-R1

## 一、官方原话

> **In the official DeepSeek web/app, we don't use system prompts but design two specific prompts for file upload and web search for better user experience. In addition, the temperature in web/app is 0.6.**

翻译：

> 在 DeepSeek 官方的网页版 / App 里，**我们并不使用系统提示词**，而是为「文件上传」和「联网搜索」设计了两个专用提示词，以改善体验。另外，网页版 / App 的 temperature 是 **0.6**。

所以：**不存在一个"你是一个乐于助人的 AI 助手……"的全局 system prompt。** 你在 GitHub 上看到的所谓"DeepSeek App 系统提示词"，基本都是这几种东西之一：

1. 用越狱话术**套出来的模型自述**，不是预置的（模型会顺着问题编一段人设）；
2. **第三方客户端**（Chatbox、LobeChat 等）自带的提示词，不是官方 App 的；
3. 把下面这两个**场景模板**误当成了系统提示词。

官方唯一预置的，就是下面三条。

---

## 二、文件上传模板

```python
file_template = \
"""[file name]: {file_name}
[file content begin]
{file_content}
[file content end]
{question}"""
```

三个占位符：`{file_name}` 文件名、`{file_content}` 文件全文、`{question}` 用户的问题。

结构很朴素：先给名字，再给全文，最后接问题。没有任何"请仔细阅读"之类的指令——它假设模型自己会读。

---

## 三、联网搜索模板（中文）

```python
search_answer_zh_template = \
'''# 以下内容是基于用户发送的消息的搜索结果:
{search_results}
在我给你的搜索结果中，每个结果都是[webpage X begin]...[webpage X end]格式的，X代表每篇文章的数字索引。请在适当的情况下在句子末尾引用上下文。请按照引用编号[citation:X]的格式在答案中对应部分引用上下文。如果一句话源自多个上下文，请列出所有相关的引用编号，例如[citation:3][citation:5]，切记不要将引用集中在最后返回引用编号，而是在答案对应部分列出。
在回答时，请注意以下几点：
- 今天是{cur_date}。
- 并非搜索结果的所有内容都与用户的问题密切相关，你需要结合问题，对搜索结果进行甄别、筛选。
- 对于列举类的问题（如列举所有航班信息），尽量将答案控制在10个要点以内，并告诉用户可以查看搜索来源、获得完整信息。优先提供信息完整、最相关的列举项；如非必要，不要主动告诉用户搜索结果未提供的内容。
- 对于创作类的问题（如写论文），请务必在正文的段落中引用对应的参考编号，例如[citation:3][citation:5]，不能只在文章末尾引用。你需要解读并概括用户的题目要求，选择合适的格式，充分利用搜索结果并抽取重要信息，生成符合用户要求、极具思想深度、富有创造力与专业性的答案。你的创作篇幅需要尽可能延长，对于每一个要点的论述要推测用户的意图，给出尽可能多角度的回答要点，且务必信息量大、论述详尽。
- 如果回答很长，请尽量结构化、分段落总结。如果需要分点作答，尽量控制在5个点以内，并合并相关的内容。
- 对于客观类的问答，如果问题的答案非常简短，可以适当补充一到两句相关信息，以丰富内容。
- 你需要根据用户要求和回答内容选择合适、美观的回答格式，确保可读性强。
- 你的回答应该综合多个相关网页来回答，不能重复引用一个网页。
- 除非用户要求，否则你回答的语言需要和用户提问的语言保持一致。

# 用户消息为：
{question}'''
```

## 四、联网搜索模板（英文）

```python
search_answer_en_template = \
'''# The following contents are the search results related to the user's message:
{search_results}
In the search results I provide to you, each result is formatted as [webpage X begin]...[webpage X end], where X represents the numerical index of each article. Please cite the context at the end of the relevant sentence when appropriate. Use the citation format [citation:X] in the corresponding part of your answer. If a sentence is derived from multiple contexts, list all relevant citation numbers, such as [citation:3][citation:5]. Be sure not to cluster all citations at the end; instead, include them in the corresponding parts of the answer.
When responding, please keep the following points in mind:
- Today is {cur_date}.
- Not all content in the search results is closely related to the user's question. You need to evaluate and filter the search results based on the question.
- For listing-type questions (e.g., listing all flight information), try to limit the answer to 10 key points and inform the user that they can refer to the search sources for complete information. Prioritize providing the most complete and relevant items in the list. Avoid mentioning content not provided in the search results unless necessary.
- For creative tasks (e.g., writing an essay), ensure that references are cited within the body of the text, such as [citation:3][citation:5], rather than only at the end of the text. You need to interpret and summarize the user's requirements, choose an appropriate format, fully utilize the search results, extract key information, and generate an answer that is insightful, creative, and professional. Extend the length of your response as much as possible, addressing each point in detail and from multiple perspectives, ensuring the content is rich and thorough.
- If the response is lengthy, structure it well and summarize it in paragraphs. If a point-by-point format is needed, try to limit it to 5 points and merge related content.
- For objective Q&A, if the answer is very brief, you may add one or two related sentences to enrich the content.
- Choose an appropriate and visually appealing format for your response based on the user's requirements and the content of the answer, ensuring strong readability.
- Your answer should synthesize information from multiple relevant webpages and avoid repeatedly citing the same webpage.
- Unless the user requests otherwise, your response should be in the same language as the user's question.

# The user's message is:
{question}'''
```

---

## 五、另外两条官方建议（同一份 README）

关于 R1 系列模型的用法，官方给的建议里有一条和"提示词怎么写"直接相关：

> **Avoid adding a system prompt; all instructions should be contained within the user prompt.**

即：**不要加 system prompt，所有指令放进 user 消息**。理由是 R1 这类推理模型对 system 角色不敏感，容易忽略。

还有：

> Set the temperature within the range of 0.5-0.7 (0.6 is recommended) to prevent endless repetitions or incoherent outputs.

温度 0.5–0.7，推荐 0.6。

---

## 六、对咱们这个小说评论 App 意味着什么

1. **"官方系统提示词"这条路走不通**——它不存在。想要效果，得自己写，就是 `docs/prompts-v3.md` 那套。
2. **调用 `deepseek-flash` 时**，system 消息是正常生效的（V 系列支持），现在的写法没问题。
3. **如果换成 R1 / 带思考的模型**，应该把人设和规则从 `system` 挪到 `user` 里，否则会被忽略。这一条可以做成设置里的一个开关。
4. 官方搜索模板里有一条值得抄：**"不要在文末集中列引用，要在对应句子里标"**。这正好对应我们短评"必须引用原文"的规则——引用要嵌在评论里，而不是末尾贴一句原文。
