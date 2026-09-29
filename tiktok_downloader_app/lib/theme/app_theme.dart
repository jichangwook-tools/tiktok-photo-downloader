import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color background = Color(0xFF0D0E15);
  static const Color cardBg = Color(0xFF141622);
  static const Color cardHover = Color(0xFF1B1E2E);
  static const Color inputBg = Color(0xFF10121C);
  static const Color border = Color(0xFF242738);

  static const Color tiktokRed = Color(0xFFFE2C55);
  static const Color tiktokCyan = Color(0xFF25F4EE);

  static const Color textMain = Color(0xFFF5F6FA);
  static const Color textMuted = Color(0xFF8D92A6);
  static const Color textDim = Color(0xFF5C6175);

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: background,
      primaryColor: tiktokRed,
      colorScheme: const ColorScheme.dark(
        primary: tiktokRed,
        secondary: tiktokCyan,
        surface: cardBg,
      ),
      textTheme: GoogleFonts.alataTextTheme(ThemeData.dark().textTheme).apply(
        bodyColor: textMain,
        displayColor: textMain,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: background,
        elevation: 0,
        centerTitle: true,
      ),
    );
  }
}
