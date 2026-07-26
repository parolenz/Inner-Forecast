// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract InnerForecast {
    uint8 public constant CONDITIONS = 6;
    uint8 public constant DAILY_LIMIT = 5;

    struct Profile {
        uint64 totalReports;
        uint64 streak;
        uint64 lastActiveDay;
        uint8 todayCount;
        uint8 lastCondition;
        uint64 lastReportedAt;
    }

    mapping(address => Profile) private profiles;
    mapping(address => mapping(uint8 => uint64)) private conditionCounts;

    uint64 public globalReports;

    error InvalidCondition();
    error DailyLimitReached();

    event ForecastReported(
        address indexed user,
        uint8 indexed condition,
        uint8 dailyNumber,
        uint64 timestamp
    );

    function report(uint8 condition) external {
        if (condition >= CONDITIONS) revert InvalidCondition();

        uint64 currentDay = uint64(block.timestamp / 1 days);
        Profile storage profile = profiles[msg.sender];

        if (profile.lastActiveDay != currentDay) {
            if (
                profile.lastActiveDay != 0 &&
                profile.lastActiveDay + 1 == currentDay
            ) {
                profile.streak += 1;
            } else {
                profile.streak = 1;
            }

            profile.lastActiveDay = currentDay;
            profile.todayCount = 0;
        }

        if (profile.todayCount >= DAILY_LIMIT) {
            revert DailyLimitReached();
        }

        profile.todayCount += 1;
        profile.totalReports += 1;
        profile.lastCondition = condition;
        profile.lastReportedAt = uint64(block.timestamp);

        conditionCounts[msg.sender][condition] += 1;
        globalReports += 1;

        emit ForecastReported(
            msg.sender,
            condition,
            profile.todayCount,
            uint64(block.timestamp)
        );
    }

    function statsOf(address user) external view returns (Profile memory stats) {
        stats = profiles[user];

        uint64 currentDay = uint64(block.timestamp / 1 days);
        if (stats.lastActiveDay != currentDay) {
            stats.todayCount = 0;
        }
    }

    function conditionCountOf(
        address user,
        uint8 condition
    ) external view returns (uint64) {
        if (condition >= CONDITIONS) revert InvalidCondition();
        return conditionCounts[user][condition];
    }
}
