/* gulpfile.js
 * Originally created 3/11/2017 by DaAwesomeP
 * This is the main build/task file of the extension
 * https://github.com/DaAwesomeP/tab-counter
 *
 * Copyright 2017-present DaAwesomeP
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const gulp = require('gulp')
const del = require('del')
const lec = require('gulp-line-ending-corrector')
const bro = require('gulp-bro')
const babelify = require('babelify')
const eslint = require('gulp-eslint')
const rename = require('gulp-rename')
const sourcemaps = require('gulp-sourcemaps')
const zip = require('gulp-zip')

gulp.task('static', () => {
  return gulp.src('src/**/*.js')
    .pipe(lec())
    .pipe(gulp.dest('src'))
})

gulp.task('clean', (callback) => {
  del(['dist/*', 'build/*']).then(() => {
    callback()
  })
})

gulp.task('compile', gulp.parallel(() => {
  return gulp.src('src/**/*.js')
    .pipe(sourcemaps.init())
    .pipe(bro({
      transform: [
        babelify.configure()
      ]
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('dist'))
}, () => {
  return gulp.src(['src/**/*', '!src/**/*.js'])
    .pipe(gulp.dest('dist'))
}))

gulp.task('pack', gulp.parallel(() => {
  return gulp.src(['dist/**/*', '!dist/**/*.map', 'node_modules/underscore/**/*', 'icons/**/clear-*.png', 'icons/**/*.min.svg', 'manifest.firefox.json', 'LICENSE'], { base: '.' })
    .pipe(rename(path => {
      if (path.basename === 'manifest.firefox') {
        path.basename = 'manifest'
      }
    }))
    .pipe(zip('tab-counter.firefox.zip'))
    .pipe(gulp.dest('build'))
}, () => {
  return gulp.src(['dist/**/*.js', 'dist/**/*.html', 'node_modules/webextension-polyfill/dist/browser-polyfill.js', 'node_modules/underscore/underscore.js', 'icons/**/*.png', 'icons/**/*.min.svg', 'manifest.opera.json', 'LICENSE'], { base: '.' })
    .pipe(rename(path => {
      if (path.basename === 'manifest.opera') {
        path.basename = 'manifest'
      }
    }))
    .pipe(zip('tab-counter.opera.zip'))
    .pipe(gulp.dest('build'))
}))

gulp.task('watch', gulp.series('compile', () => {
  return gulp.watch(['src/**/*', 'node_modules/webextension-polyfill/**/*', 'node_modules/underscore/**/*', 'icons/**/*', 'manifest.json', 'package.json'], gulp.parallel('checkSafe', 'compile'))
}))

gulp.task('dist', gulp.series('static', 'clean', 'compile'))
gulp.task('build', gulp.series('dist', 'pack'))
gulp.task('default', gulp.series('build'))
