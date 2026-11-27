# OpenFormosa Governance / 治理章程

> 狀態：草案 v0.1（過渡期）。本文件適用於 OpenFormosa GitHub 組織下的所有專案，除非該專案另有更嚴格的規定。
> Status: draft v0.1 (transition period). Applies to every repository in the OpenFormosa GitHub organization unless a repository sets stricter rules.

## 1. 目的 / Purpose

OpenFormosa 是由貢獻者共同完成的開源社群專案。本章程的目的只有一個：讓專案不依賴任何一個人，並讓 credit 屬於所有貢獻者。

OpenFormosa is a community project built by its contributors. This document exists so that the project does not depend on any single person, and so that credit belongs to everyone who contributes.

## 2. 組織現況 / Current status

- OpenFormosa 目前是**非法人的開源社群**，尚未登記為社團法人或財團法人。
- 社群**不以 OpenFormosa 名義公開募款**，也不以 OpenFormosa 名義與任何人簽約，直到有立案的代管單位或法人可以承接。
- 支持單位（例如運算資源或研究支持）會在網站公開致謝。支持單位不擁有成果，也不取得決策權。

## 3. 原則 / Principles

1. **預設開放。** 權重、程式碼、評測、訓練紀錄與決策預設公開。
2. **使命比組織長久。** 已釋出成果採用不可撤回的開放授權。
3. **Credit 屬於貢獻者。** 所有類型的貢獻都會被記錄與感謝。
4. **沒有人不可取代。** 每個關鍵資產至少兩位管理者。
5. **支持者不主導方向。** 贊助不換取決策權、獨占授權或評測結果。

## 4. 角色 / Roles

| 角色 Role | 取得方式 How | 權限 Rights |
| --- | --- | --- |
| 貢獻者 Contributor | 任何被接受的貢獻：程式碼、評測、文件、翻譯、語言審校、設計、社群、錯誤案例 | 列入貢獻者名單 |
| 審查者 Reviewer | 在某專案持續貢獻，由該專案維護者提名，無人反對即生效 | 審查與核准 PR |
| 維護者 Maintainer | 由該專案現任維護者共識或三分之二同意 | 合併 PR、發佈版本、管理 issue |
| 指導小組 Steering Group | 由全體維護者每年選出，3 至 5 人 | 跨專案決策、共用帳號與資產、行為準則處理 |

- **獨立性：** 指導小組中，同一雇主或同一實驗室的成員不得超過半數。
- **榮譽維護者：** 維護者 6 個月無活動，或主動請辭，轉為榮譽維護者（emeritus）。credit 保留，寫入權限移除，隨時可以申請回任。
- **過渡期：** 全體維護者不足 3 人時為過渡期。過渡期由現任維護者暫代指導小組，所有決策仍須公開紀錄。維護者達 3 人後 30 天內舉行第一次指導小組選舉。

## 5. 決策 / Decision making

1. **一般變更：** lazy consensus。在 PR 或 issue 公告後 72 小時內無維護者反對即可合併。
2. **重大變更：** 授權、治理、資產轉移、新增或封存子專案、對外合作協議。需在 GitHub Discussions 開 RFC，討論至少 7 天，經全體維護者三分之二同意。
3. **紀錄：** Discord 可以討論，但決定必須記錄在 GitHub（issue、PR 或 discussion）。
4. **利益衝突：** 參與決策者若與決策事項有利益關係（例如雇主是贊助方），應主動揭露並迴避表決。

## 6. Credit 與署名 / Credit and authorship

- 每個 repo 維護貢獻者名單，貢獻類型參考 [All Contributors](https://allcontributors.org/docs/en/emoji-key)。
- 技術報告與模型卡以「OpenFormosa Contributors」為作者，並附完整名單與 [CRediT](https://credit.niso.org/) 分工。
- 每份 release notes 列出該版本的貢獻者。
- 貢獻者可選擇以暱稱列名。
- 個人以 OpenFormosa 成果發表學術論文時，應依實際貢獻邀請共同作者，並在致謝中列出 OpenFormosa Contributors。

## 7. 資產與持續性 / Assets and continuity

| 資產 Asset | 最低要求 Minimum |
| --- | --- |
| GitHub 組織 | 至少 2 位 owner，全員啟用 2FA |
| Hugging Face 組織 | 至少 2 位 admin；模型權重與 Demo 放在組織帳號，不放個人帳號 |
| 網域與 DNS（Cloudflare） | 至少 2 位可登入管理者；自動續約；到期日記錄在維護者文件 |
| Discord | 至少 2 位管理員；擁有者轉移流程寫入維護者文件 |
| 信箱 | 轉寄給至少 2 位指導小組成員 |
| 共用憑證 | 存放於共享密碼庫，不存放於個人裝置 |

## 8. 授權與貢獻 / Licensing and contributions

- 程式碼與模型依各 repo 的 LICENSE 釋出。已釋出版本的授權不撤回。
- 貢獻採用 [Developer Certificate of Origin (DCO)](https://developercertificate.org/)：每個 commit 加上 `Signed-off-by: 名字 <email>`（`git commit -s`）。貢獻者保留著作權，並以專案授權釋出。OpenFormosa 不使用要求轉讓權利的 CLA。

## 9. 修訂 / Amendments

本章程的修訂屬於重大變更，依第 5 條第 2 款辦理。
Amendments to this document are major changes under Section 5.2.
