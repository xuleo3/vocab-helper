// ============================================================
// 日常口语：一句一句学（不设测试）
// 单元按场景划分，每条 = 一句英文 + 中文翻译；仅学习/跟读。
// 结构生成 ORAL_BOOK / ORAL_WORDS，由 store.js 无损补建。
// ============================================================
window.ORAL_VERSION = 1;
window.ORAL_UNITS = [
  {"id":"oral_u1","name":"Unit 1 · 问候与打招呼","list":[["Hello!","你好！"],["Hi there!","嗨，你好！"],["Good morning!","早上好！"],["Good afternoon!","下午好！"],["Good evening!","晚上好！"],["How are you?","你好吗？"],["How are you doing?","你最近怎么样？"],["How's it going?","最近怎么样？"],["What's up?","怎么啦？/最近怎样？"],["Long time no see.","好久不见。"],["Nice to meet you.","很高兴认识你。"],["Nice to meet you too.","我也很高兴认识你。"],["How have you been?","你过得怎么样？"],["I'm fine, thank you. And you?","我很好，谢谢。你呢？"],["Pretty good, thanks.","挺好的，谢谢。"],["Not bad.","还不错。"],["Same as usual.","老样子。"],["Glad to see you again.","很高兴又见到你。"],["Welcome back!","欢迎回来！"],["See you later!","回头见！"],["See you tomorrow.","明天见。"],["Have a nice day!","祝你今天愉快！"]]},
  {"id":"oral_u2","name":"Unit 2 · 介绍与寒暄","list":[["What's your name?","你叫什么名字？"],["My name is ...","我叫……"],["Nice to meet you, I'm ...","很高兴认识你，我是……"],["Where are you from?","你从哪里来？"],["I'm from China.","我来自中国。"],["What do you do?","你是做什么工作的？"],["I'm a student.","我是学生。"],["I work in shipping.","我在航运行业工作。"],["This is my friend.","这是我的朋友。"],["May I introduce myself?","请允许我自我介绍一下。"],["What brings you here?","什么风把你吹来了？"],["How do you know him?","你怎么认识他的？"],["We're just talking.","我们只是随便聊聊。"],["Where do you live?","你住在哪里？"],["I live in Shanghai.","我住在上海。"],["Do you live nearby?","你住得近吗？"],["It's a small world.","世界真小。"],["What a coincidence!","真巧！"],["Nice talking to you.","跟你聊天很开心。"],["Let's keep in touch.","我们保持联系吧。"],["I hope to see you again.","希望再见到你。"]]},
  {"id":"oral_u3","name":"Unit 3 · 感谢与道歉","list":[["Thank you very much.","非常感谢。"],["Thanks a lot.","多谢。"],["Thanks for your help.","谢谢你的帮助。"],["I really appreciate it.","我真的很感激。"],["You're welcome.","不客气。"],["Don't mention it.","不用客气。"],["No problem at all.","完全没问题。"],["It was my pleasure.","这是我应该做的。"],["Thanks for your time.","感谢你抽出时间。"],["I'm grateful to you.","我很感激你。"],["Sorry about that.","这件事很抱歉。"],["I apologize for the mistake.","我为这个错误道歉。"],["Please forgive me.","请原谅我。"],["It's my fault.","是我的错。"],["I didn't mean to do that.","我不是故意的。"],["That's all right.","没关系。"],["Never mind.","别在意。"],["It's okay, don't worry.","没事，别担心。"],["I'm sorry I'm late.","抱歉我迟到了。"],["Please excuse me for a moment.","请稍等（失陪一下）。"],["I won't let it happen again.","我不会再让这种事发生。"]]},
  {"id":"oral_u4","name":"Unit 4 · 请求与帮助","list":[["Could you help me, please?","你能帮帮我吗？"],["Can you do me a favor?","能帮我个忙吗？"],["May I ask you a question?","我可以问你一个问题吗？"],["Would you mind helping me?","你介意帮我一下吗？"],["Could you speak more slowly?","你能说慢一点吗？"],["Could you say that again?","你能再说一遍吗？"],["What does this mean?","这是什么意思？"],["How do you say this in English?","这个用英语怎么说？"],["Can you give me a hand?","你能搭把手吗？"],["Please open the door.","请开门。"],["Could you close the window?","你能把窗户关上吗？"],["Please wait a moment.","请等一下。"],["Excuse me, may I come in?","打扰一下，我可以进来吗？"],["Can I use your phone?","我能用一下你的电话吗？"],["Could you show me the way?","你能给我指路吗？"],["Please pass me the salt.","请把盐递给我。"],["Would you like a cup of tea?","你想来杯茶吗？"],["Yes, please.","好的，麻烦了。"],["No, thank you.","不用了，谢谢。"],["I need some help with this.","这件事我需要帮忙。"],["Thank you for your kindness.","谢谢你的好意。"]]},
  {"id":"oral_u5","name":"Unit 5 · 时间与天气","list":[["What time is it?","现在几点了？"],["It's eight o'clock.","现在八点。"],["What day is it today?","今天星期几？"],["What's the date today?","今天几号？"],["Today is Monday.","今天是星期一。"],["I get up at seven.","我七点起床。"],["What time do you go to work?","你几点去上班？"],["I'm running late.","我要迟到了。"],["Hurry up, please.","请快点。"],["Take your time.","慢慢来，不着急。"],["How's the weather today?","今天天气怎么样？"],["It's sunny today.","今天晴天。"],["It's raining outside.","外面在下雨。"],["It's very cold today.","今天很冷。"],["It's hot and humid.","又热又潮湿。"],["It's windy.","风很大。"],["It's cloudy.","今天多云。"],["It's snowing.","下雪了。"],["What's the temperature?","气温多少度？"],["It's about twenty degrees.","大约二十度。"],["Bring an umbrella with you.","记得带伞。"],["The weather is nice today.","今天天气不错。"]]},
  {"id":"oral_u6","name":"Unit 6 · 问路与出行","list":[["Excuse me, where is the subway station?","请问地铁站在哪里？"],["How can I get to the airport?","去机场怎么走？"],["Is it far from here?","离这里远吗？"],["It's about ten minutes on foot.","步行大约十分钟。"],["Go straight ahead.","一直往前走。"],["Turn left at the corner.","在拐角处左转。"],["Turn right at the traffic light.","在红绿灯处右转。"],["You can take the bus.","你可以坐公交车。"],["Which bus should I take?","我应该坐哪路公交？"],["How much is the ticket?","票价多少钱？"],["Where should I get off?","我该在哪里下车？"],["Please let me know when to get off.","到站时请告诉我。"],["I'm lost.","我迷路了。"],["Could you draw me a map?","你能给我画个地图吗？"],["Is there a taxi stand near here?","附近有出租车停靠点吗？"],["Please take me to this address.","请带我去这个地址。"],["How long does it take to get there?","到那里要多久？"],["It takes about half an hour.","大约需要半小时。"],["I'd like to book a ticket.","我想订一张票。"],["One way or round trip?","单程还是往返？"],["Have a good trip!","祝你旅途愉快！"]]},
  {"id":"oral_u7","name":"Unit 7 · 购物与价格","list":[["I'd like to do some shopping.","我想去购物。"],["How much is this?","这个多少钱？"],["How much does it cost?","它多少钱？"],["That's too expensive.","太贵了。"],["Can you give me a discount?","能给我打个折吗？"],["Is there any cheaper one?","有更便宜的吗？"],["I'll take this one.","我买这个。"],["Could you show me another one?","能给我看另一件吗？"],["Do you have this in a larger size?","这个有大一码的吗？"],["Do you have this in another color?","这个有其他颜色吗？"],["I'm just looking, thanks.","我只是看看，谢谢。"],["Where is the fitting room?","试衣间在哪里？"],["It fits me well.","这件很适合我。"],["It's too small / too big.","太小了 / 太大了。"],["How would you like to pay?","您想怎么付款？"],["Can I pay by card?","我可以刷卡吗？"],["I'll pay in cash.","我用现金付款。"],["Could I have a receipt?","能给我一张收据吗？"],["Can I return this if it doesn't fit?","不合适可以退吗？"],["Keep the change.","不用找零了。"],["Is there a supermarket nearby?","附近有超市吗？"]]},
  {"id":"oral_u8","name":"Unit 8 · 餐厅与饮食","list":[["I'm hungry. Let's go eat.","我饿了，我们去吃饭吧。"],["What would you like to eat?","你想吃点什么？"],["Could I see the menu, please?","请给我看一下菜单。"],["What do you recommend?","你有什么推荐的吗？"],["I'd like to order now.","我现在想点餐。"],["I'll have this one, please.","我要这个。"],["Could I have a glass of water?","请给我一杯水。"],["No sugar, please.","请不要加糖。"],["It's delicious!","真好吃！"],["Could I have some more rice?","能再给我一些米饭吗？"],["I'm full. I can't eat any more.","我饱了，吃不下了。"],["Could you bring me the bill, please?","请把账单给我。"],["Is the service charge included?","包含服务费吗？"],["Let's split the bill.","我们AA制吧。"],["It's my treat this time.","这次我请客。"],["Could I book a table for two?","我可以订一张两人的桌子吗？"],["A table for two, please.","请安排一张两人桌。"],["Do you have a table by the window?","有靠窗的位子吗？"],["What's today's special?","今天的特色菜是什么？"],["Could I get this to go?","这个可以打包吗？"],["Thank you for the meal.","谢谢款待。"]]},
  {"id":"oral_u9","name":"Unit 9 · 电话与约会","list":[["Hello, may I speak to ...?","你好，请找……接电话。"],["This is ... speaking.","我是……。"],["Who's calling, please?","请问您是哪位？"],["Hold on, please.","请稍等。"],["He's not here right now.","他现在不在。"],["Can I take a message?","需要我捎个口信吗？"],["Could you call back later?","你过会儿再打来好吗？"],["Sorry, I dialed the wrong number.","抱歉，我打错电话了。"],["The line is busy.","电话占线。"],["Please hang up and try again.","请挂断后再拨。"],["I can't hear you clearly.","我听不清你说话。"],["Could you speak up, please?","你能大声一点吗？"],["Let's meet this weekend.","我们周末见个面吧。"],["Are you free on Saturday?","你周六有空吗？"],["I'm free all day tomorrow.","我明天一整天都有空。"],["What time is good for you?","你什么时间方便？"],["Let's meet at three o'clock.","我们三点见吧。"],["I'm sorry, I have to cancel.","抱歉，我得取消。"],["Let's make it another day.","我们改天吧。"],["See you at the coffee shop.","咖啡店见。"]]},
  {"id":"oral_u10","name":"Unit 10 · 情绪与工作学习","list":[["I'm very happy today.","我今天很开心。"],["I'm a little tired.","我有点累。"],["I'm worried about the exam.","我担心考试。"],["Don't worry, everything will be fine.","别担心，一切都会好的。"],["Take it easy.","放轻松。"],["Cheer up!","振作起来！"],["What's the matter?","怎么了？"],["Are you feeling okay?","你感觉还好吗？"],["I'm feeling much better now.","我现在好多了。"],["I'm looking forward to the trip.","我期待这次旅行。"],["What do you think about it?","你觉得怎么样？"],["I agree with you.","我同意你的看法。"],["I don't think so.","我不这么认为。"],["That sounds like a good idea.","听起来是个好主意。"],["Let me think about it.","让我想想。"],["I have a lot of work to do today.","我今天有很多工作要做。"],["Could you give me some advice?","你能给我一些建议吗？"],["I'm learning English every day.","我每天都在学英语。"],["I'll do my best.","我会尽力的。"],["You can do it!","你一定能行！"],["Good luck with your exam!","祝你考试顺利！"]]},
];

(function () {
  var BOOK_ID = 'oral';
  var BOOK_NAME = '日常口语';
  var EXAM = 'oral';
  var words = {};
  var units = [];
  var widSeq = 0;
  function nextId() { return 'oral_' + (widSeq++); }
  window.ORAL_UNITS.forEach(function (u) {
    var wordIds = [];
    (u.list || []).forEach(function (it) {
      var id = nextId();
      var en = String(it[0] || '').trim();
      var zh = String(it[1] || '').trim();
      words[id] = {
        id: id, headword: en, phonetic: '', pos: '',
        examType: EXAM, bookId: BOOK_ID, unit: units.length,
        senses: [{ meaning: zh }], collocations: [], tips: [], synonyms: []
      };
      wordIds.push(id);
    });
    units.push({ id: u.id, name: u.name, wordIds: wordIds });
  });
  var allIds = [];
  units.forEach(function (u) { u.wordIds.forEach(function (w) { allIds.push(w); }); });
  window.ORAL_BOOK = {
    id: BOOK_ID, name: BOOK_NAME, examType: EXAM, kind: 'oral', source: 'builtin',
    units: units, wordIds: allIds
  };
  window.ORAL_WORDS = words;
})();