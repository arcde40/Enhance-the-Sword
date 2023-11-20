/*
 * Created on Sun Jan 31 2021
 *
 * Copyright (c) storycraft. Licensed under the MIT Licence.
 */

/*
 * Login using email, password using AuthApiClient.
 * Following this example will make automatic reply at text "안녕하세요" with mention.
 */

import { fail } from "assert";
import { SourceMap } from "module";
import {
  AuthApiClient,
  ChatBuilder,
  KnownChatType,
  MentionContent,
  ReplyContent,
  TalkClient,
} from "node-kakao";
import { send } from "process";

// Supply env variables or replace to value.
const DEVICE_UUID = process.env["deviceUUID"] as string;
const DEVICE_NAME = process.env["deviceName"] as string;

const EMAIL = process.env["accountEmail"] as string;
const PASSWORD = process.env["accountPwd"] as string;

const CLIENT = new TalkClient();
var i = 0;

CLIENT.on("chat", (data, channel) => {
  const sender = data.getSenderInfo(channel);
  if (!sender) return;
  // Group Chatting avoid
  if (channel.userCount >= 20) return;
  const user = sender.userId.toString();
  if (!coolTimeMap.has(user)) coolTimeMap.set(user, 0);
  if (!swordLevel.has(user)) swordLevel.set(user, 0);
  if (!tries.has(user)) tries.set(user, [0, 0, 0, 0, 0]);
  if (data.text.startsWith("!")) channel.markRead(data.chat);
  // DEBUG
  // Nothing.

  if (data.text === "!강화" || data.text === "!ㄱㅎ" || data.text === "!ㄱ") {
    if (!swordLevel.has(user)) swordLevel.set(user, 0);
    if (!ticketMap.has(user)) ticketMap.set(user, 0);
    if (ticketMap.get(user) >= 1) {
      let plusProb = getPlusProb(user);

      channel.sendChat(
        new ChatBuilder()
          .append(new MentionContent(sender))
          .text("님의 ")
          .text(SWORD_NAME[swordLevel.get(user)])
          .text(" 강화를 시작합니다! (성공 확률 ")
          .text((probability[swordLevel.get(user)] * 100).toString())
          .text(plusProb > 0 ? `+ ${plusProb}` : ``)
          .text("%)")
          .build(KnownChatType.TEXT)
      );
      if (!prestige_alwaysSuccess.get(user))
        prestige_alwaysSuccess.set(user, 0);
      let result;
      if (
        prestige_alwaysSuccess.get(user) > 0 &&
        prestige_alwaysSuccess.get(user) + prestige_default >=
          swordLevel.get(user)
      ) {
        result = upgrade(user, 100);
      } else result = upgrade(user, plusProb);

      if (result > 0) {
        channel.sendChat(
          new ChatBuilder()
            .text(
              `성공!! ${SWORD_NAME[swordLevel.get(user) - 1]}이 ${
                SWORD_NAME[swordLevel.get(user)]
              }으로 강화되었습니다!\n`
            )
            .text(
              `다음 강화 시 성공 확률: ${
                probability[swordLevel.get(user)] * 100
              }%\n`
            )
            .text(`판매 금액: ${sell_price[swordLevel.get(user)]} 포인트`)
            .build(KnownChatType.TEXT)
        );
      } else if (result == 0) {
        switch (upgradeFailed(user)) {
          case 1:
            channel.sendChat(
              new ChatBuilder()
                .text("실패! 검이 유지되었습니다!")
                .build(KnownChatType.TEXT)
            );
            break;
          case 2:
            channel.sendChat(
              new ChatBuilder()
                .text("실패! 검 등급이 하락하였습니다! ㅠㅠ\n")
                .text(
                  `${SWORD_NAME[swordLevel.get(user) + 1]} → ${
                    SWORD_NAME[swordLevel.get(user)]
                  }`
                )
                .build(KnownChatType.TEXT)
            );
            if (inventory.has(user) && inventory.get(user)[2] > 0) {
              channel.sendChat("하락방지권을 사용했습니다!");
              inventory.set(
                user,
                inventory.get(user).map((element, index) => {
                  if (index == 2) return element - 1;
                  else return element;
                })
              );
              swordLevel.set(user, swordLevel.get(user) + 1);
            }
            break;
          case 3:
            channel.sendChat(
              new ChatBuilder()
                .text("실패! 검이 뽀개졌습니다 ㅋ\n")
                .text(`${SWORD_NAME[swordLevel.get(user)]} → ${SWORD_NAME[0]}`)
                .build(KnownChatType.TEXT)
            );
            if (inventory.has(user) && inventory.get(user)[1] > 0) {
              channel.sendChat("까임방지권을 사용했습니다!");
              inventory.set(
                user,
                inventory.get(user).map((element, index) => {
                  if (index == 1) return element - 1;
                  else return element;
                })
              );
            } else swordLevel.set(user, 0);
            break;
        }
      }
    } else {
      channel.sendChat(
        new ChatBuilder()
          .text("강화권 티켓이 부족합니다!")
          .build(KnownChatType.TEXT)
      );
    }
  } else if (data.text === "!돈" || data.text === "!ㄷ") {
    if (!ticketMap.has(user)) ticketMap.set(user, 0);
    if (!pointMap.has(user)) pointMap.set(user, 0);
    channel.sendChat(
      new ChatBuilder()
        .append(new MentionContent(sender))
        .text("님의 포인트 : ")
        .text(new Intl.NumberFormat().format(pointMap.get(user)))
        .text(" / 보유 티켓 : ")
        .text(ticketMap.get(user).toString())
        .text(
          prestigeMap.has(user)
            ? "\n환생 포인트 : " + round(prestigeMap.get(user))
            : ""
        )
        .build(KnownChatType.TEXT)
    );
  } else if (data.text === "!설명") {
    channel.sendChat(
      new ChatBuilder()
        .text(
          "-- 검 강화하기 --\n검을 강화합시다. 10분마다 티켓을 수집할 수 있습니다.\n!수집으로 티켓을 수집하세요.\n티켓으로 강화를 할 수 있습니다.\n검을 강화하고 팔아 강화에 유용한 아이템을 구매하세요!!\n!돈 - 보유 티켓 및 포인트\n!강화 - 강화 시도\n!자랑 - 자신의 검을 자랑해요\n!상점 - 돈으로 아이템을 구매합니다(개인톡으로만 가능)\n!판매 - 검을 판매합니다.\n!인벤토리\n!환생\n!랭킹\n!수집"
        )
        .build(KnownChatType.TEXT)
    );
  } else if (data.text === "!자랑" || data.text === "!ㅈㄹ") {
    let str = "";
    switch (swordLevel.get(user)) {
      case 0:
        str = "이걸 자랑한다고요? ㅋ";
        break;
      /*case 1:
        str = "나무네요! 멋져요.";
        break;
      case 2:
        str = "돌검이네요.";
        break;
      case 3:
        str = "철검이네요. 몇번만에 왔죠?";
        break;
      case 4:
        str = "오.. 금검이네요! 꽤 귀한 물건이죠.";
        break;
      case 5:
        str = "다이아몬드 검? 다음은 힘들걸요?";
        break;
      case 6:
        str = "축하합니다!";
        break;
      default:
        str = "undefined라니..";
        break;*/
    }

    channel.sendChat(
      new ChatBuilder()
        .append(new MentionContent(sender))
        .text(
          `님이 ${
            SWORD_NAME[swordLevel.get(user)]
          }을 자랑합니다!\n${str}\n----\n`
        )
        .text(
          `강화 시도 횟수: ${tries.get(user)[0]}\n성공 횟수: ${
            tries.get(user)[1]
          }\n깨먹은 횟수: ${tries.get(user)[4]}\n유지한 횟수: ${
            tries.get(user)[2]
          }\n하락한 횟수: ${tries.get(user)[3]}${
            prestigeMap.has(user)
              ? "\n환생 포인트: " + prestigeMap.get(user)
              : ""
          }`
        )
        .build(KnownChatType.TEXT)
    );
  } else if (data.text.startsWith("!상점")) {
    let args = data.text.split(" ");
    if (args.length == 1) {
      if (channel.userCount >= 3) return;
      channel.sendChat(
        new ChatBuilder()
          .text(`------ 상점 ------\n`)
          .text(`잔액: ${new Intl.NumberFormat().format(pointMap.get(user))}\n`)
          .text(`사용법 : !상점 <번호> <수량(기본 1)>\n`)
          .text(
            `\n1. 까임방지권 - 검의 파괴를 1회 막아줍니다. (180,000,000 Point)
2. 하락방지권 - 검의 하락을 1회 막아줍니다. (5,000,000 point)
3. 마법의 연마제 - 다음 1회의 강화 성공 확률을 1%p 올립니다. 10회 중첩 가능 (1,000,000 point)
4. 마력의 연마제 - 다음 1회의 강화 성공 확률을 1%p 올립니다. 10회 중첩 가능 (10,000,000 point)
5. 제왕의 연마제 - 다음 1회의 강화 성공 확률을 1%p 올립니다. 10회 중첩 가능 (100,000,000 point)
6. 랜덤박스 - 1 ~ 50000 point의 돈을 랜덤으로 획득합니다. (25,000 point)
7. 비트코인 - 매일 가치가 변합니다. (1,000,000,000 point)
연마제류는 각 종류별로 10회 이상 중첩 및 강화 시 자동으로 10개만 소모되고 잔량은 이월됩니다.`
          )
          .build(KnownChatType.TEXT)
      );
    } else if (args[1] === "환생") {
      if (!prestigeMap.has(user)) prestigeMap.set(user, 0);
      if (!prestige_up.has(user)) prestige_up.set(user, 0);
      if (!prestige_alwaysSuccess.has(user)) prestige_up.set(user, 0);
      if (!prestige_cooltime.has(user)) prestige_up.set(user, 0);
      if (!prestige_limit.has(user)) prestige_limit.set(user, defaultLimit);
      if (args.length > 2) {
        let idx = parseInt(args[2]);
        if (isNaN(idx) || idx > 5) {
          channel.sendChat(
            new ChatBuilder()
              .text("올바르지 않은 품목 번호입니다!")
              .build(KnownChatType.TEXT)
          );
          return;
        }
        let price = 0;
        switch (idx) {
          case 1:
            price = round(1 * 1.5 ** prestige_cooltime.get(user));
            break;
          case 2:
            price = round(10 * 2.2 ** prestige_nextSword.get(user));
            break;
          case 3:
            price = round(5 * 1.9 ** prestige_alwaysSuccess.get(user));
            break;
          case 4:
            price = round(
              0.5 *
                prestigeLimitCoef **
                  ((prestige_limit.get(user) - defaultLimit) / 10)
            );
            break;
          case 5:
            price = 1 * 1.44 ** prestige_up.get(user);
            break;
        }
        if (prestigeMap.get(user) < price) {
          channel.sendChat(
            new ChatBuilder()
              .text(`포인트가 부족합니다! 잔액: ${prestigeMap.get(user)}`)
              .build(KnownChatType.TEXT)
          );
          return;
        }
        switch (idx) {
          case 1:
            prestige_cooltime.set(user, prestige_cooltime.get(user) + 1);
            break;
          case 2:
            prestige_nextSword.set(user, prestige_nextSword.get(user) + 1);
            break;
          case 3:
            prestige_alwaysSuccess.set(
              user,
              prestige_alwaysSuccess.get(user) + 1
            );
            break;
          case 4:
            prestige_limit.set(user, prestige_limit.get(user) + 10);
            break;
          case 5:
            prestige_up.set(user, prestige_up.get(user) + 1);
            break;
        }

        channel.sendChat("구매 완료!");
        prestigeMap.set(user, prestigeMap.get(user) - price);
      } else {
        if (channel.userCount >= 3) return;
        if (!prestige_cooltime.has(user)) prestige_cooltime.set(user, 0);
        if (!prestige_alwaysSuccess.has(user))
          prestige_alwaysSuccess.set(user, 0);
        if (!prestige_nextSword.has(user)) prestige_nextSword.set(user, 0);
        if (!prestige_up.has(user)) prestige_up.set(user, 0);
        channel.sendChat(
          `보유 환생 포인트: ${round(
            prestigeMap.get(user)
          )}\n----- 환생 업그레이드 -----\n사용법: !상점 환생 <번호>\n1. 다음 티켓 획득 수집 가능 기간이 30% 빨라집니다. (${
            round(ticketGiveCooldown * 0.7 ** prestige_cooltime.get(user)) /
            1000
          } 초 → ${
            round(
              ticketGiveCooldown * 0.7 ** (prestige_cooltime.get(user) + 1)
            ) / 1000
          } 초) - ${round(
            1 * 1.5 ** prestige_cooltime.get(user)
          )} 환생 포인트\n\n2. 환생 시 ${
            SWORD_NAME[prestige_nextSword.get(user) + prestige_default + 1]
          }부터 시작합니다. - ${round(
            10 * 2.2 ** prestige_nextSword.get(user)
          )} 환생 포인트\n\n3. ${
            SWORD_NAME[prestige_alwaysSuccess.get(user) + prestige_default + 1]
          }까지의 강화는 항상 성공합니다. - ${round(
            5 * 1.9 ** prestige_alwaysSuccess.get(user)
          )} 환생 포인트\n\n4. 강화권 최대 수집 개수가 10 늘어납니다. (${prestige_limit.get(
            user
          )}→${prestige_limit.get(user) + 10}) - ${round(
            0.5 *
              prestigeLimitCoef **
                ((prestige_limit.get(user) - defaultLimit) / 10)
          )} 환생 포인트` +
            `\n\n5. 환생 시 얻는 포인트가 ${
              (prestige_up.get(user) + 1) * 0.5 + 1
            } 배가 됩니다. - ${1 * 1.44 ** prestige_up.get(user)} 환생 포인트
            `
        );
      }
    } else if (args.length >= 2) {
      let idx = parseInt(args[1]);
      if (isNaN(idx) || idx > 7) {
        channel.sendChat(
          new ChatBuilder()
            .text("올바르지 않은 품목 번호입니다!")
            .build(KnownChatType.TEXT)
        );
        return;
      }
      let count = 1;
      if (args.length == 3) count = parseInt(args[2]);
      if (isNaN(count) || count < 1) {
        channel.sendChat(
          new ChatBuilder()
            .text("올바르지 않은 수량입니다!")
            .build(KnownChatType.TEXT)
        );
        return;
      }
      if (pointMap.get(user) < store_price[idx] * count) {
        channel.sendChat(
          new ChatBuilder()
            .text(
              `포인트가 부족합니다! 잔액: ${pointMap.get(user)} / 총액: ${
                store_price[idx] * count
              }`
            )
            .build(KnownChatType.TEXT)
        );
        return;
      }
      channel.sendChat(
        new ChatBuilder().text("구매 완료!").build(KnownChatType.TEXT)
      );
      inventory.set(
        user,
        inventory.has(user)
          ? inventory.get(user).map((element, index) => {
              if (index == idx) return element + count;
              else return element;
            })
          : [0, 0, 0, 0, 0, 0, 0, 0].map((element, index) => {
              if (index == idx) return element + count;
              else return element;
            })
      );
      pointMap.set(user, pointMap.get(user) - store_price[idx] * count);
    }
  } else if (data.text === "!판매") {
    channel.sendChat(
      new ChatBuilder()
        .text(
          `${SWORD_NAME[swordLevel.get(user)]}을 판매하였습니다!\n${
            sell_price[swordLevel.get(user)]
          } 포인트 획득!`
        )
        .build(KnownChatType.TEXT)
    );
    if (!pointMap.has(user)) pointMap.set(user, 0);
    pointMap.set(user, pointMap.get(user) + sell_price[swordLevel.get(user)]);
    swordLevel.set(user, 0);
  } else if (data.text === "!인벤토리" || data.text === "!인벤") {
    if (!inventory.has(user)) {
      channel.sendChat("---- 인벤토리 ----\n가진 것이 없습니다!");
      return;
    }
    const inv = inventory.get(user);
    let str = "---- 인벤토리 ----";
    if (inv[1] > 0) str += `\n까임방지권 : ${inv[1]}`;
    if (inv[2] > 0) str += `\n하락방지권 : ${inv[2]}`;
    if (inv[3] > 0) str += `\n마법의 연마제 : ${inv[3]}`;
    if (inv[4] > 0) str += `\n마력의 연마제 : ${inv[4]}`;
    if (inv[5] > 0) str += `\n제왕의 연마제 : ${inv[5]}`;
    if (inv[6] > 0) str += `\n랜덤박스 : ${inv[6]}`;
    if (inv[7] > 0) str += `\n비트코인 : ${inv[7]}`;
    if (str === "") str = "\n가진 것이 없습니다!";
    channel.sendChat(str);
  } else if (data.text === "!수집" || data.text === "!ㅅㅈ") {
    if (!pendingTicket.has(user)) pendingTicket.set(user, 1);
    const count = pendingTicket.get(user);
    if (count == 0) channel.sendChat("수집할 강화권 티켓이 없습니다!");
    else {
      channel.sendChat(
        new ChatBuilder()
          .append(new MentionContent(sender))
          .text(`님이 강화권 티켓 ${count}개를 획득하셨습니다!`)
          .build(KnownChatType.TEXT)
      );
      if (!ticketMap.has(user)) ticketMap.set(user, 0);
      ticketMap.set(user, ticketMap.get(user) + count);
      pendingTicket.set(user, 0);
    }
  } else if (data.text === "!랭킹") {
    /*const mapSort1 = new Map(
      [...swordLevel.entries()].sort((a, b) => b[1] - a[1])
    );*/
    let a = [];
    for (var x of swordLevel) a.push(x);
    console.log(a);
    a.sort(function (x, y) {
      return x[1] - y[1];
    });

    let sorted = new Map<string, number>(a);

    let str = "------ 검 랭킹 ------";
    let idx = 1;
    sorted.forEach((point, user) => {
      str += `\n${idx++}. ${user} - ${SWORD_NAME[point]}`;
    });
    channel.sendChat(str);
  } else if (data.text === "!환생") {
    if (swordLevel.get(user) == SWORD_NAME.length - 1) {
      if (!prestige_nextSword.has(user)) prestige_nextSword.set(user, 0);

      if (prestige_nextSword.get(user) > 0)
        swordLevel.set(user, prestige_nextSword.get(user) + prestige_default);
      else swordLevel.set(user, 0);
      if (!prestigeMap.has(user)) prestigeMap.set(user, 0);
      const prestigePoint =
        getPrestigePoint(pointMap.get(user)) *
        (prestige_up.get(user) * 0.5 + 1);
      prestigeMap.set(user, prestigeMap.get(user) + prestigePoint);
      console.log(prestigePoint);
      pointMap.set(user, 0);
      inventory.set(user, [0, 0, 0, 0, 0, 0, 0, 0]);
      channel.sendChat(
        new ChatBuilder()
          .append(new MentionContent(sender))
          .text(
            `님, 환생이 완료되었습니다!\n얻은 환생 포인트: ${prestigePoint}`
          )
          .build(KnownChatType.TEXT)
      );
    } else {
      channel.sendChat(
        "환생은 " + SWORD_NAME[SWORD_NAME.length - 1] + "에서만 가능합니다!"
      );
    }
  } else if (data.text === "!정보" || data.text === "!ㅈㅂ") {
    if (!prestige_limit.has(user)) prestige_limit.set(user, defaultLimit);
    if (!prestige_cooltime.has(user)) prestige_cooltime.set(user, 0);
    if (!prestige_alwaysSuccess.has(user)) prestige_alwaysSuccess.set(user, 0);
    if (!prestige_nextSword.has(user)) prestige_nextSword.set(user, 0);
    if (!prestige_up.has(user)) prestige_up.set(user, 0);
    channel.sendChat(
      new ChatBuilder()
        .text("----- ")
        .append(new MentionContent(sender))
        .text("님의 정보 -----\n")
        .text(
          `보유 검: ${SWORD_NAME[swordLevel.get(user)]}` +
            `\n남은 시간: ${round(
              coolTimeMap.get(user) / 1000
            )}초\n최대 티켓 수령 시간: ${round(
              round(ticketGiveCooldown * 0.7 ** prestige_cooltime.get(user)) /
                1000
            )}초\n미수령 티켓 개수: ${pendingTicket.get(user)}` +
            `\n최대 수집 가능 티켓 개수: ${prestige_limit.get(user)}` +
            (prestige_alwaysSuccess.get(user) > 0
              ? `\n이 유저는 ${
                  SWORD_NAME[
                    prestige_alwaysSuccess.get(user) + prestige_default
                  ]
                }까지의 강화는 무조건 성공합니다.`
              : ``) +
            (prestige_nextSword.get(user) > 0
              ? `\n이 유저는 환생 시 ${
                  SWORD_NAME[prestige_nextSword.get(user) + prestige_default]
                }부터 시작합니다.`
              : ``) +
            `\n지금 환생 시 ${round(
              getPrestigePoint(pointMap.get(user)) *
                (prestige_up.get(user) * 0.5 + 1)
            )} 환생 포인트를 얻습니다.`
        )
        .build(KnownChatType.TEXT)
    );
  } else if (data.text.startsWith("!연속강화")) {
    const args = data.text.split(" ");
    if (args.length == 1) {
      channel.sendChat(
        new ChatBuilder()
          .append(new MentionContent(sender))
          .text(" !연속강화 <목표 검 번호>")
          .text(
            "\n목표 검 번호: 막대기: 0 ~ 네더라이트 검: 20\n다이아몬드 도끼: 13"
          )
          .build(KnownChatType.TEXT)
      );
    } else {
      const goal = parseInt(args[1]);
      if (isNaN(goal) || goal < 0 || goal > 20) {
        channel.sendChat("유효하지 않은 검 번호입니다!");
        return;
      }
      console.log(goal);
      let total_result = [0, 0, 0, 0, 0, 0];
      let trying;
      let str = "";

      if (!swordLevel.has(user)) swordLevel.set(user, 0);
      if (!ticketMap.has(user)) ticketMap.set(user, 0);
      console.log("Starting..!");
      for (trying = 0; ; trying++) {
        if (swordLevel.get(user) >= goal) {
          total_result[5] = 2; // Goal Reached!
          break;
        }
        if (ticketMap.get(user) >= 1) {
          total_result[0]++; // 시행횟수
          let plusProb = getPlusProb(user);
          if (!prestige_alwaysSuccess.has(user))
            prestige_alwaysSuccess.set(user, 0);
          let result;
          if (
            prestige_alwaysSuccess.get(user) > 0 &&
            prestige_alwaysSuccess.get(user) + prestige_default >=
              swordLevel.get(user)
          ) {
            result = upgrade(user, 100);
          } else result = upgrade(user, plusProb);
          // result
          console.log(result);
          if (result == 0) {
            switch (upgradeFailed(user)) {
              case 1:
                // 실패
                total_result[2]++;
                break;
              case 2:
                total_result[3]++;
                // 하락
                if (inventory.has(user) && inventory.get(user)[2] > 0) {
                  channel.sendChat("하락방지권을 사용했습니다!");
                  inventory.set(
                    user,
                    inventory.get(user).map((element, index) => {
                      if (index == 2) return element - 1;
                      else return element;
                    })
                  );
                  swordLevel.set(user, swordLevel.get(user) + 1);
                }
                break;
              case 3:
                total_result[4]++;
                // 뽀개짐
                if (inventory.has(user) && inventory.get(user)[1] > 0) {
                  channel.sendChat("까임방지권을 사용했습니다!");
                  inventory.set(
                    user,
                    inventory.get(user).map((element, index) => {
                      if (index == 1) return element - 1;
                      else return element;
                    })
                  );
                  str += `${SWORD_NAME[swordLevel.get(user)]} → 막대기 (방어) `;
                } else {
                  str += `${SWORD_NAME[swordLevel.get(user)]} → 막대기 `;
                  swordLevel.set(user, 0);
                }
                break;
            }
          } else {
            total_result[1]++;
          }
        } else {
          // 티켓 부족
          total_result[5] = 1;
          break;
        }
      }

      channel.sendChat(
        new ChatBuilder()
          .append(new MentionContent(sender))
          .text(" 연속 강화가 끝났습니다!")
          .text(
            `\n목표 무기: ${SWORD_NAME[goal]} / 강화 결과: ${
              SWORD_NAME[swordLevel.get(user)]
            }`
          )
          .text(
            total_result[5] == 1
              ? "\n목표 무기에 도달하지 못했습니다..!"
              : "\n목표 무기에 도달했습니다!"
          )
          .text(
            `\n소모된 강화권 티켓: ${total_result[0]}\n성공: ${
              total_result[1]
            }\n유지: ${total_result[2]}\n하락: ${total_result[3]}\n깨짐: ${
              total_result[4]
            } ${total_result[4] > 0 ? `( ${str} )` : ""}`
          )
          .build(KnownChatType.TEXT)
      );
    }
  }
});

const prestige_default = 12;

let ticketMap = new Map<string, number>();
let prestige_cooltime = new Map<string, number>();
let prestige_nextSword = new Map<string, number>();
let prestige_alwaysSuccess = new Map<string, number>();
let prestigeMap = new Map<string, number>();
let pointMap = new Map<string, number>();
let inventory = new Map<string, number[]>();
let swordLevel = new Map<string, number>();
let tries = new Map<string, number[]>();
let coolTimeMap = new Map<string, number>();
let pendingTicket = new Map<string, number>();
let prestige_limit = new Map<string, number>();
let prestige_up = new Map<string, number>();
const probability = [
  0.9, 0.9, 0.8, 0.8, 0.75, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.5, 0.45, 0.4,
  0.3, 0.2, 0.1, 0.05, 0.01, 0.005, -0.3,
];
const sell_price = [
  0, 1, 10, 50, 150, 600, 1700, 8300, 19700, 56800, 234000, 725300, 1970000,
  5000000, 18000000, 175000000, 758000000, 2390000000, 17600000000, 65500000000,
  990000000000,
];
const store_price = [
  0, 180000000, 5000000, 1000000, 10000000, 100000000, 25000, 1000000000,
  5000000, 175000000,
];
const fail_penalty = [
  [0.99, 0, 0.01],
  [0.98, 0.01, 0.01],
  [0.94, 0.05, 0.01],
  [0.9, 0.08, 0.02],
  [0.85, 0.13, 0.02],
  [0.8, 0.18, 0.02],
  [0.75, 0.23, 0.02],
  [0.7, 0.28, 0.02],
  [0.65, 0.33, 0.02],
  [0.6, 0.38, 0.02],
  [0.5, 0.43, 0.07],
  [0.45, 0.45, 0.1],
  [0.43, 0.46, 0.11],
  [0.41, 0.43, 0.16],
  [0.38, 0.45, 0.17],
  [0.3, 0.48, 0.22],
  [0.1, 0.75, 0.15],
  [0.1, 0.7, 0.2],
  [0.1, 0.65, 0.25],
  [0.1, 0.65, 0.25],
  [1, 0, 0],
]; // 유지, 하락, 파괴
const SWORD_NAME = [
  "막대기",
  "낚싯대",
  "나무 검",
  "나무 도끼",
  "당근 낚싯대",
  "활",
  "돌 검",
  "돌 도끼",
  "철 검",
  "철 도끼",
  "금 검",
  "금 도끼",
  "다이아몬드 검",
  "다이아몬드 도끼",
  "삼지창",
  "네더라이트 검",
  "날카로움 I 네더라이트 검",
  "날카로움 II 네더라이트 검",
  "날카로움 III 네더라이트 검",
  "날카로움 IV 네더라이트 검",
  "날카로움 V 네더라이트 검",
];

const ticketCheckInterval = 1000;
const ticketGiveCooldown = 180000;
const backupInterval = 10000;

const prestigeLimitCoef = 1.2;
const defaultLimit = 30;

function getPrestigePoint(money: number): number {
  return round(
    Math.log(
      round(
        (money + sell_price[SWORD_NAME.length - 1]) /
          sell_price[SWORD_NAME.length - 1]
      )
    ) /
      Math.log(10) +
      1
  );
}

function giveTicket() {
  coolTimeMap.forEach((cooltime, user) => {
    if (coolTimeMap.get(user) <= 0) {
      if (!prestige_limit.has(user)) prestige_limit.set(user, defaultLimit);
      if (!prestige_cooltime.has(user)) prestige_cooltime.set(user, 0);
      coolTimeMap.set(
        user,
        ticketGiveCooldown * 0.7 ** prestige_cooltime.get(user)
      );
      if (!pendingTicket.has(user)) pendingTicket.set(user, 0);
      if (pendingTicket.get(user) < prestige_limit.get(user))
        pendingTicket.set(user, pendingTicket.get(user) + 1);
    } else {
      coolTimeMap.set(user, coolTimeMap.get(user) - ticketCheckInterval);
    }
  });
}

function upgrade(user: string, plusProb: number = 0): number {
  ticketMap.set(user, ticketMap.get(user) - 1);
  if (!tries.has(user)) tries.set(user, [0, 0, 0, 0, 0]);
  tries.set(
    user,
    tries.get(user).map((element, index) => {
      if (index == 0) return element + 1;
      else return element;
    })
  );

  if (randomRoll(probability[swordLevel.get(user)] + plusProb * 0.01)) {
    swordLevel.set(user, swordLevel.get(user) + 1);
    tries.set(
      user,
      tries.get(user).map((element, index) => {
        if (index == 1) return element + 1;
        else return element;
      })
    );
    return 1;
  }
  return 0;
}

function upgradeFailed(user: string): number {
  switch (rollProb(fail_penalty[swordLevel.get(user)])) {
    case 0:
      tries.set(
        user,
        tries.get(user).map((element, index) => {
          if (index == 2) return element + 1;
          else return element;
        })
      );
      return 1;
    case 1:
      tries.set(
        user,
        tries.get(user).map((element, index) => {
          if (index == 3) return element + 1;
          else return element;
        })
      );
      swordLevel.set(user, swordLevel.get(user) - 1);
      return 2;
    case 2:
      tries.set(
        user,
        tries.get(user).map((element, index) => {
          if (index == 4) return element + 1;
          else return element;
        })
      );
      return 3;
    default:
      return 1;
  }
}

function getPlusProb(user: string): number {
  let plusProb = 0;
  if (inventory.has(user)) {
    let temp: number;
    if ((temp = inventory.get(user)[3]) > 0) {
      if (temp > 10) plusProb += 10;
      else plusProb += temp;
      inventory.set(
        user,
        inventory.get(user).map((element, index) => {
          if (index == 3) return element - (temp > 10 ? 10 : temp);
          else return element;
        })
      );
    }
    if ((temp = inventory.get(user)[4]) > 0) {
      if (temp > 10) plusProb += 10;
      else plusProb += temp;
      inventory.set(
        user,
        inventory.get(user).map((element, index) => {
          if (index == 4) return element - (temp > 10 ? 10 : temp);
          else return element;
        })
      );
    }
    if ((temp = inventory.get(user)[5]) > 0) {
      if (temp > 10) plusProb += 10;
      else plusProb += temp;
      inventory.set(
        user,
        inventory.get(user).map((element, index) => {
          if (index == 5) return element - (temp > 10 ? 10 : temp);
          else return element;
        })
      );
    }
  }

  return plusProb;
}

function randomRoll(a: number): boolean {
  return Math.random() <= a;
}
function rollProb(a: number[]): number {
  const rndNum = Math.random();
  console.log(a);
  let total = 0;
  let result = -1;
  a.some((element, index) => {
    total += element;
    console.log(
      `total: ${total}, rndNum: ${rndNum}, element: ${element}, ${
        total >= rndNum
      }`
    );
    if (total >= rndNum) {
      result = index;
      return true;
    }
  });
  return result;
}
async function main() {
  const api = await AuthApiClient.create(DEVICE_NAME, DEVICE_UUID);
  const loginRes = await api.login({
    email: EMAIL,
    password: PASSWORD,

    // This option force login even other devices are logon
    forced: true,
  });
  if (!loginRes.success)
    throw new Error(`Web login failed with status: ${loginRes.status}`);

  console.log(`Received access token: ${loginRes.result.accessToken}`);

  const res = await CLIENT.login(loginRes.result);
  if (!res.success) throw new Error(`Login failed with status: ${res.status}`);

  console.log("Login success");

  console.log("Retrieving Backups..");

  load();
  console.log("Done!");

  console.log("Ticket Timer Started.");
  setInterval(giveTicket, ticketCheckInterval);
  console.log("Backup system Started.");
  setInterval(backup, backupInterval);
}
main().then();

function load() {
  var fs = require("fs");
  fs.readFile("pendingTicket.txt", function (err, data) {
    pendingTicket = new Map(JSON.parse(data));
  });
  fs.readFile("ticket.txt", function (err, data) {
    ticketMap = new Map(JSON.parse(data));
  });
  fs.readFile("sword.txt", function (err, data) {
    swordLevel = new Map(JSON.parse(data));
  });
  fs.readFile("prestige_nextsword.txt", function (err, data) {
    prestige_nextSword = new Map(JSON.parse(data));
  });
  fs.readFile("prestige_always.txt", function (err, data) {
    prestige_alwaysSuccess = new Map(JSON.parse(data));
  });
  fs.readFile("prestige_cooltime.txt", function (err, data) {
    prestige_cooltime = new Map(JSON.parse(data));
  });
  fs.readFile("prestige.txt", function (err, data) {
    prestigeMap = new Map(JSON.parse(data));
  });
  fs.readFile("pointMap.txt", function (err, data) {
    pointMap = new Map(JSON.parse(data));
  });
  fs.readFile("tries.txt", function (err, data) {
    tries = new Map(JSON.parse(data));
  });
  fs.readFile("inventory.txt", function (err, data) {
    inventory = new Map(JSON.parse(data));
  });
  fs.readFile("cooldown.txt", function (err, data) {
    coolTimeMap = new Map(JSON.parse(data));
  });
  fs.readFile("limit.txt", function (err, data) {
    prestige_limit = new Map(JSON.parse(data));
  });
  fs.readFile("up.txt", function (err, data) {
    prestige_up = new Map(JSON.parse(data));
  });
}

function backup() {
  var fs = require("fs");
  fs.writeFile(
    "pendingTicket.txt",
    JSON.stringify(Array.from(pendingTicket.entries())),
    function (error) {}
  );
  fs.writeFile(
    "ticket.txt",
    JSON.stringify(Array.from(ticketMap.entries())),
    function (error) {}
  );
  fs.writeFile(
    "prestige.txt",
    JSON.stringify(Array.from(prestigeMap.entries())),
    function (error) {
      console.log("Backup Complete.");
    }
  );
  fs.writeFile(
    "pointMap.txt",
    JSON.stringify(Array.from(pointMap.entries())),
    function (error) {}
  );
  fs.writeFile(
    "sword.txt",
    JSON.stringify(Array.from(swordLevel.entries())),
    function (error) {}
  );
  fs.writeFile(
    "prestige_always.txt",
    JSON.stringify(Array.from(prestige_alwaysSuccess.entries())),
    function (error) {}
  );
  fs.writeFile(
    "prestige_cooltime.txt",
    JSON.stringify(Array.from(prestige_cooltime.entries())),
    function (error) {}
  );
  fs.writeFile(
    "prestige_nextsword.txt",
    JSON.stringify(Array.from(prestige_nextSword.entries())),
    function (error) {}
  );
  fs.writeFile(
    "tries.txt",
    JSON.stringify(Array.from(tries.entries())),
    function (error) {}
  );
  fs.writeFile(
    "inventory.txt",
    JSON.stringify(Array.from(inventory.entries())),
    function (error) {}
  );
  fs.writeFile(
    "cooldown.txt",
    JSON.stringify(Array.from(coolTimeMap.entries())),
    function (error) {}
  );
  fs.writeFile(
    "limit.txt",
    JSON.stringify(Array.from(prestige_limit.entries())),
    function (error) {}
  );
  fs.writeFile(
    "up.txt",
    JSON.stringify(Array.from(prestige_up.entries())),
    function (error) {}
  );
}

function round(a: number): number {
  return Math.round(a * 100) / 100;
}

/*
기획: 한계 돌파 & 제작 시스템
한계 돌파: 한계 돌파를 할 때마다 새로운 무기 레벨이 추가됨
무기 강화는 제작 시스템으로 이루어지고 항상 성공함
제작: 검을 제작할 때 특수한 보조재료가 필요하고 이는 던전 클리어로 얻을 수 있음

던전: 무한의 탑
제작한 무기를 장착하거나 장착 전용 무기를 입수하여 무기로 사용할 수 있음
방패, 장신구 제작법이나 재료, 또는 그 장비를 획득할 수 있음

전투 매커니즘: 전투력에 의해 DPS를 계산, 주어진 시간동안 데미지를 욱여넣는 시스템

광질: 환생 포인트를 이용하여 광부 로봇을 설치할 수 있음
광부 로봇은 n분에 한번씩 채굴을 시도하여 재료를 수집함.

엔딩: 무한의 탑 10층
==> 예상 클리어 시간: 7일


*/

let infinityMap = new Map<string, number>();
let breakMap = new Map<string, number>();
let bag = new Map<string, number[]>();
let miner = new Map<string, number>();