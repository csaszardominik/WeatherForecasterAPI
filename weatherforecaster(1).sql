-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 19, 2026 at 07:32 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `weatherforecaster`
--
CREATE DATABASE IF NOT EXISTS `weatherforecaster` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;
USE `weatherforecaster`;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `ID` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `passwd` varchar(100) NOT NULL,
  `role` enum('user','admin') NOT NULL,
  `satus` enum('Allowed','Banned','','') NOT NULL,
  `reg` datetime NOT NULL DEFAULT current_timestamp(),
  `last` datetime NOT NULL DEFAULT current_timestamp(),
  `loginCount` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`ID`, `name`, `email`, `passwd`, `role`, `satus`, `reg`, `last`, `loginCount`) VALUES
(1, 'user', 'user@gmail.com', '95c946bf622ef93b0a211cd0fd028dfdfcf7e39e', 'user', 'Banned', '2026-10-04 15:33:46', '2026-10-04 15:33:46', 0),
(2, 'admin', 'admin@gmail.com', 'f865b53623b121fd34ee5426c792e5c33af8c227', 'admin', 'Banned', '2026-10-04 15:33:46', '2026-10-04 15:33:46', 0),
(3, 'Asd Dsa', 'asd@gmail.com', '1f3c53ae14626035383b39c207564d32d083e8fd', 'user', 'Banned', '2026-10-15 17:39:20', '2026-10-15 17:39:20', 0),
(4, 'Szia', 'szia@gmail.com', '46068d0e3ea57db1ea7b851c02047bdb3a3ca771', 'user', 'Allowed', '2026-10-18 13:21:54', '2026-10-18 13:21:54', 0),
(5, 'nemtudom', 'nemtudom@gmail.com', '46068d0e3ea57db1ea7b851c02047bdb3a3ca771', 'user', 'Allowed', '2026-10-18 13:40:54', '2026-10-18 13:40:54', 0),
(6, 'adminn', 'adminn@gmail.com', '89bab5f0b08706cb91def52eff4afa6faff49e3f', 'admin', '', '2026-10-18 15:08:24', '2026-10-19 07:29:13', 22),
(7, 'sziaa', 'sziaa@gmail.com', '40bd001563085fc35165329ea1ff5c5ecbdbbeef', 'user', 'Allowed', '2026-10-18 15:39:18', '2026-10-18 15:39:18', 0),
(8, 'asd', 'asd@gmail.com', 'f66a34e386a896075368912ce2693459775d247a', 'user', 'Allowed', '2026-10-18 15:41:49', '2026-10-18 15:41:49', 0),
(9, 'Asd Dsa', 'asda@gmail.com', '1f3c53ae14626035383b39c207564d32d083e8fd', 'user', 'Allowed', '2026-10-18 15:54:15', '2026-10-18 15:54:15', 0),
(10, 'Szabó Gabi', 'gabi@gmail.com', 'ae0fba09c2a8cbba86f44bfe5756f671d4802059', 'user', 'Allowed', '2026-10-18 16:01:04', '2026-10-18 16:14:04', 1),
(11, 'Asd asd', 'asdaaa@gmail.com', '60650c4d76144fbb8e9acaa320ccf2f9d2737d25', 'user', 'Allowed', '2026-10-18 16:03:31', '2026-10-18 18:33:04', 9);

-- --------------------------------------------------------

--
-- Table structure for table `weather_forecasts`
--

CREATE TABLE `weather_forecasts` (
  `ID` int(11) NOT NULL,
  `date` date DEFAULT NULL,
  `location` varchar(100) NOT NULL,
  `temp_min` decimal(4,1) NOT NULL,
  `temp_max` decimal(4,1) NOT NULL,
  `weather_type` varchar(50) NOT NULL,
  `precipitation` decimal(5,2) NOT NULL,
  `precipitation_probability` int(11) NOT NULL,
  `wind_speed` decimal(5,2) NOT NULL,
  `wind_direction` varchar(100) NOT NULL,
  `humidity` int(11) NOT NULL,
  `pressure` decimal(6,2) NOT NULL,
  `uv_index` decimal(3,1) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- Dumping data for table `weather_forecasts`
--

INSERT INTO `weather_forecasts` (`ID`, `date`, `location`, `temp_min`, `temp_max`, `weather_type`, `precipitation`, `precipitation_probability`, `wind_speed`, `wind_direction`, `humidity`, `pressure`, `uv_index`, `created_at`, `updated_at`) VALUES
(1, '2026-10-15', 'Budapest', 15.0, 30.0, 'windy', 2.00, 65, 45.00, 'east', 32, 65.00, 21.0, '2026-10-18 17:06:23', '2026-10-19 07:23:51'),
(2, '2026-10-08', 'Baja', 0.5, 1.2, 'sunny', 0.50, 8, 0.70, 'north', 50, 1013.00, 0.4, '2026-10-19 07:24:25', '2026-10-19 07:24:25');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `weather_forecasts`
--
ALTER TABLE `weather_forecasts`
  ADD PRIMARY KEY (`ID`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `weather_forecasts`
--
ALTER TABLE `weather_forecasts`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
