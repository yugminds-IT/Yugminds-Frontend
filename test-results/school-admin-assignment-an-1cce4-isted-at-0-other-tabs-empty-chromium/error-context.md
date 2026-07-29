# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: school-admin/assignment-analytics.spec.ts >> School Admin — Assignment Analytics >> renders honest zero-activity state: students listed at 0%, other tabs empty
- Location: e2e/school-admin/assignment-analytics.spec.ts:35:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('0.0%', { exact: true })
Expected: visible
Error: strict mode violation: getByText('0.0%', { exact: true }) resolved to 13 elements:
    1) <p class="text-2xl font-bold text-gray-900 leading-none">0.0%</p> aka getByText('%').first()
    2) <p class="text-sm font-bold text-gray-200">0.0%</p> aka getByText('%').nth(1)
    3) <p class="text-sm font-bold text-yellow-300">0.0%</p> aka getByText('%').nth(2)
    4) <p class="text-sm font-bold text-amber-200">0.0%</p> aka getByText('%').nth(3)
    5) <span class="font-semibold text-gray-400">0.0%</span> aka getByText('%').nth(5)
    6) <span class="font-semibold text-gray-400">0.0%</span> aka getByText('0.0%').nth(5)
    7) <span class="font-semibold text-gray-400">0.0%</span> aka locator('span').filter({ hasText: '%' }).nth(2)
    8) <span class="font-semibold text-gray-400">0.0%</span> aka locator('span').filter({ hasText: '%' }).nth(3)
    9) <span class="font-semibold text-gray-400">0.0%</span> aka locator('span').filter({ hasText: '%' }).nth(4)
    10) <span class="font-semibold text-gray-400">0.0%</span> aka locator('span').filter({ hasText: '%' }).nth(5)
    ...

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText('0.0%', { exact: true })

```

```
Error: apiRequestContext._wrapApiCall: ENOENT: no such file or directory, open '/Users/likithkarnekota/Yugminds Website/Yugminds Frontend/test-results/.playwright-artifacts-0/traces/resources/page@8c61f65e8a16c0638a8cd36caf6e2085-1784702031003.jpeg'
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]:
    - img [ref=e8]
  - alert [ref=e11]
  - generic [ref=e12]:
    - generic [ref=e13]:
      - generic [ref=e14]:
        - generic [ref=e15]:
          - generic [ref=e17]: SA
          - generic [ref=e18]:
            - generic [ref=e19]: School Admin
            - generic [ref=e20]: School Administrator
        - button "Collapse sidebar" [ref=e21] [cursor=pointer]:
          - img [ref=e22]
      - generic [ref=e25]:
        - img [ref=e26]
        - textbox "Search..." [ref=e29]
      - navigation [ref=e30]:
        - list [ref=e31]:
          - listitem [ref=e32]:
            - button "Overview" [ref=e33] [cursor=pointer]:
              - img [ref=e35]
              - generic [ref=e39]: Overview
          - listitem [ref=e40]:
            - button "Students Management" [ref=e41] [cursor=pointer]:
              - img [ref=e43]
              - generic [ref=e47]: Students Management
          - listitem [ref=e48]:
            - button "Teachers Management" [ref=e49] [cursor=pointer]:
              - img [ref=e51]
              - generic [ref=e57]: Teachers Management
          - listitem [ref=e58]:
            - button "Class Scheduling" [ref=e59] [cursor=pointer]:
              - img [ref=e61]
              - generic [ref=e64]: Class Scheduling
          - listitem [ref=e65]:
            - button "School Calendar" [ref=e66] [cursor=pointer]:
              - img [ref=e68]
              - generic [ref=e71]: School Calendar
          - listitem [ref=e72]:
            - button "Teacher Reports" [ref=e73] [cursor=pointer]:
              - img [ref=e75]
              - generic [ref=e79]: Teacher Reports
          - listitem [ref=e80]:
            - button "Courses" [ref=e81] [cursor=pointer]:
              - img [ref=e83]
              - generic [ref=e86]: Courses
          - listitem [ref=e87]:
            - button "Student Progress" [ref=e88] [cursor=pointer]:
              - img [ref=e90]
              - generic [ref=e93]: Student Progress
          - listitem [ref=e94]:
            - button "Assignment Analytics" [ref=e95] [cursor=pointer]:
              - img [ref=e97]
              - generic [ref=e101]: Assignment Analytics
          - listitem [ref=e102]:
            - button "Notifications" [ref=e103] [cursor=pointer]:
              - img [ref=e105]
              - generic [ref=e109]: Notifications
          - listitem [ref=e110]:
            - button "Password Reset Requests" [ref=e111] [cursor=pointer]:
              - img [ref=e113]
              - generic [ref=e117]: Password Reset Requests
          - listitem [ref=e118]:
            - button "Settings" [ref=e119] [cursor=pointer]:
              - img [ref=e121]
              - generic [ref=e125]: Settings
      - generic [ref=e126]:
        - generic [ref=e128]:
          - generic [ref=e130]: QS
          - generic [ref=e131]:
            - paragraph [ref=e132]: QA School Admin
            - paragraph [ref=e133]: __qa_test_mrvphsemw5ef___school_admin@example.test
          - generic "Online" [ref=e134]
        - button "Logout" [ref=e136] [cursor=pointer]:
          - img [ref=e138]
          - generic [ref=e141]: Logout
    - generic [ref=e143]:
      - generic [ref=e145]:
        - generic [ref=e146]:
          - img [ref=e147]
          - heading "Assignment Analytics" [level=1] [ref=e153]
        - paragraph [ref=e154]: __qa_test_mrvphsemw5ef__ School
      - generic [ref=e155]:
        - generic [ref=e156]:
          - generic [ref=e158]:
            - img [ref=e160]
            - generic [ref=e165]:
              - paragraph [ref=e166]: "3"
              - paragraph [ref=e167]: Students
          - generic [ref=e169]:
            - img [ref=e171]
            - generic [ref=e173]:
              - paragraph [ref=e174]: "0"
              - paragraph [ref=e175]: Assignments
          - generic [ref=e177]:
            - img [ref=e179]
            - generic [ref=e182]:
              - paragraph [ref=e183]: 0.0%
              - paragraph [ref=e184]: Avg Score
          - generic [ref=e186]:
            - img [ref=e188]
            - generic [ref=e190]:
              - generic [ref=e191]:
                - generic [ref=e192]: "0"
                - generic [ref=e193]: 🥇
                - generic [ref=e194]: "0"
                - generic [ref=e195]: 🥈
                - generic [ref=e196]: "0"
                - generic [ref=e197]: 🥉
              - paragraph [ref=e198]: Achievers
        - generic [ref=e200]:
          - paragraph [ref=e201]: Top Performers
          - generic [ref=e202]:
            - generic [ref=e203]:
              - generic [ref=e204]: Q
              - paragraph [ref=e205]: QA Student 1
              - paragraph [ref=e206]: 0.0%
              - generic [ref=e208]: 🥈
            - generic [ref=e209]:
              - generic [ref=e210]: Q
              - paragraph [ref=e211]: QA Student 0
              - paragraph [ref=e212]: 0.0%
              - generic [ref=e214]: 🥇
            - generic [ref=e215]:
              - generic [ref=e216]: Q
              - paragraph [ref=e217]: QA Student 2
              - paragraph [ref=e218]: 0.0%
              - generic [ref=e220]: 🥉
        - generic [ref=e221]:
          - button "Leaderboard" [ref=e222] [cursor=pointer]:
            - img [ref=e223]
            - text: Leaderboard
          - button "By Grade" [ref=e229] [cursor=pointer]:
            - img [ref=e230]
            - text: By Grade
          - button "By Subject" [ref=e231] [cursor=pointer]:
            - img [ref=e232]
            - text: By Subject
          - button "Assignments" [ref=e234] [cursor=pointer]:
            - img [ref=e235]
            - text: Assignments
        - generic [ref=e238]:
          - generic [ref=e239]:
            - generic [ref=e240]: Student Rankings
            - paragraph [ref=e241]: Overall = Course (60%) + Daily (40%) · Ranked by school, grade, and section
          - generic [ref=e243]:
            - generic [ref=e245]:
              - img [ref=e246]
              - textbox "Search student, school, grade…" [ref=e249]
            - table [ref=e251]:
              - rowgroup [ref=e252]:
                - row "# Student Grade Section Grade Rank Sec Rank School Rank Course Daily Overall Badge" [ref=e253]:
                  - columnheader "#" [ref=e254] [cursor=pointer]:
                    - text: "#"
                    - img [ref=e255]
                  - columnheader "Student" [ref=e257]
                  - columnheader "Grade" [ref=e258]
                  - columnheader "Section" [ref=e259]
                  - columnheader "Grade Rank" [ref=e260] [cursor=pointer]
                  - columnheader "Sec Rank" [ref=e261] [cursor=pointer]
                  - columnheader "School Rank" [ref=e262]
                  - columnheader "Course" [ref=e263] [cursor=pointer]
                  - columnheader "Daily" [ref=e264] [cursor=pointer]
                  - columnheader "Overall" [ref=e265] [cursor=pointer]
                  - columnheader "Badge" [ref=e266]
              - rowgroup [ref=e267]:
                - 'row "🥇 QA Student 0 Grade 1 Section A #1 #1 🥇 0.0% 0.0% 0.0% —" [ref=e268]':
                  - cell "🥇" [ref=e269]
                  - cell "QA Student 0" [ref=e270]
                  - cell "Grade 1" [ref=e271]:
                    - generic [ref=e272]: Grade 1
                  - cell "Section A" [ref=e273]:
                    - generic [ref=e274]: Section A
                  - cell "#1" [ref=e275]:
                    - generic [ref=e276]: "#1"
                  - cell "#1" [ref=e277]:
                    - generic [ref=e278]: "#1"
                  - cell "🥇" [ref=e279]
                  - cell "0.0%" [ref=e280]:
                    - generic [ref=e281]: 0.0%
                  - cell "0.0%" [ref=e282]:
                    - generic [ref=e283]: 0.0%
                  - cell "0.0%" [ref=e284]:
                    - generic [ref=e285]: 0.0%
                  - cell "—" [ref=e286]
                - 'row "🥈 QA Student 1 Grade 1 Section A #2 #2 🥈 0.0% 0.0% 0.0% —" [ref=e287]':
                  - cell "🥈" [ref=e288]
                  - cell "QA Student 1" [ref=e289]
                  - cell "Grade 1" [ref=e290]:
                    - generic [ref=e291]: Grade 1
                  - cell "Section A" [ref=e292]:
                    - generic [ref=e293]: Section A
                  - cell "#2" [ref=e294]:
                    - generic [ref=e295]: "#2"
                  - cell "#2" [ref=e296]:
                    - generic [ref=e297]: "#2"
                  - cell "🥈" [ref=e298]
                  - cell "0.0%" [ref=e299]:
                    - generic [ref=e300]: 0.0%
                  - cell "0.0%" [ref=e301]:
                    - generic [ref=e302]: 0.0%
                  - cell "0.0%" [ref=e303]:
                    - generic [ref=e304]: 0.0%
                  - cell "—" [ref=e305]
                - 'row "🥉 QA Student 2 Grade 1 Section A #3 #3 🥉 0.0% 0.0% 0.0% —" [ref=e306]':
                  - cell "🥉" [ref=e307]
                  - cell "QA Student 2" [ref=e308]
                  - cell "Grade 1" [ref=e309]:
                    - generic [ref=e310]: Grade 1
                  - cell "Section A" [ref=e311]:
                    - generic [ref=e312]: Section A
                  - cell "#3" [ref=e313]:
                    - generic [ref=e314]: "#3"
                  - cell "#3" [ref=e315]:
                    - generic [ref=e316]: "#3"
                  - cell "🥉" [ref=e317]
                  - cell "0.0%" [ref=e318]:
                    - generic [ref=e319]: 0.0%
                  - cell "0.0%" [ref=e320]:
                    - generic [ref=e321]: 0.0%
                  - cell "0.0%" [ref=e322]:
                    - generic [ref=e323]: 0.0%
                  - cell "—" [ref=e324]
```